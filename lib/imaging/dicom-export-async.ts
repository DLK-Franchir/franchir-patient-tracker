/**
 * P7 — Export étude DICOM durable (job Storage + signed download).
 *
 * Pattern Vercel-friendly (client-driven) :
 * 1. POST crée le job (status.json en Storage)
 * 2. POST …/build?part=N matérialise UNE partie ZIP sous plafond async
 * 3. GET renvoie statut + URLs signées (TTL) quand prêt
 *
 * Auth / audit = mêmes barrières que l’export sync. Pas de PHI dans les logs
 * (compteurs + hash job uniquement).
 *
 * Cleanup : cron `GET /api/internal/imaging/cleanup-async-exports` + best-effort
 * sur GET/build expiré (TTL 2 h).
 */

import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  PATIENT_DOCUMENTS_BUCKET,
  SIGNED_URL_TTL_SECONDS,
} from '@/lib/documents/patient-documents'
import {
  bufferDicomZip,
  buildAsyncStudyExportParts,
  downloadPatientDocumentBlob,
  hashSeriesUid,
  type DicomExportRow,
  type ResolvedDicomExport,
} from '@/lib/imaging/dicom-export'

/** TTL objets job (status + ZIP) — cron + best-effort au GET/build expiré. */
export const ASYNC_EXPORT_JOB_TTL_MS = 2 * 60 * 60 * 1000

/** Préfixe Storage des jobs async (hors `patients/…`). */
export const ASYNC_EXPORT_STORAGE_ROOT = 'exports'

/** Plafond jobs inspectés par run cron (Vercel-safe). */
export const ASYNC_EXPORT_CLEANUP_DEFAULT_MAX_JOBS = 80
export const ASYNC_EXPORT_CLEANUP_MAX_JOBS = 200

const JOB_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
/** Dossiers Storage : forme UUID (version/variant non stricts — chemins historiques). */
const STORAGE_UUID_FOLDER_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type AsyncExportPartState = {
  index: number
  fileCount: number
  seriesCount: number
  totalBytes: number
  storagePath: string | null
  status: 'pending' | 'ready' | 'error'
  errorCode?: string
}

export type AsyncExportJobRecord = {
  v: 1
  jobId: string
  /** Hash court patientId — jamais l’UUID brut en logs ; path Storage garde l’UUID. */
  patientIdHash: string
  status: 'queued' | 'building' | 'ready' | 'error'
  createdAt: string
  updatedAt: string
  expiresAt: string
  fileCount: number
  seriesCount: number
  totalBytes: number
  partCount: number
  completedParts: number
  parts: AsyncExportPartState[]
  errorCode?: string
}

export type AsyncExportJobPublic = {
  jobId: string
  status: AsyncExportJobRecord['status']
  createdAt: string
  updatedAt: string
  expiresAt: string
  fileCount: number
  seriesCount: number
  totalBytes: number
  partCount: number
  completedParts: number
  parts: Array<{
    index: number
    fileCount: number
    seriesCount: number
    totalBytes: number
    status: AsyncExportPartState['status']
  }>
  errorCode?: string
  /** Présent seulement si au moins une partie ready. */
  downloads?: Array<{
    index: number
    filename: string
    signedUrl: string
    expiresInSeconds: number
  }>
}

export function isValidAsyncExportJobId(jobId: string): boolean {
  return JOB_ID_RE.test(jobId)
}

export function asyncExportJobPrefix(patientId: string, jobId: string): string {
  return `${ASYNC_EXPORT_STORAGE_ROOT}/${patientId}/${jobId}`
}

export function asyncExportStatusPath(patientId: string, jobId: string): string {
  return `${asyncExportJobPrefix(patientId, jobId)}/status.json`
}

export function asyncExportPartPath(patientId: string, jobId: string, partIndex: number): string {
  return `${asyncExportJobPrefix(patientId, jobId)}/part-${partIndex + 1}.zip`
}

function toPublic(record: AsyncExportJobRecord): AsyncExportJobPublic {
  return {
    jobId: record.jobId,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    expiresAt: record.expiresAt,
    fileCount: record.fileCount,
    seriesCount: record.seriesCount,
    totalBytes: record.totalBytes,
    partCount: record.partCount,
    completedParts: record.completedParts,
    parts: record.parts.map((p) => ({
      index: p.index,
      fileCount: p.fileCount,
      seriesCount: p.seriesCount,
      totalBytes: p.totalBytes,
      status: p.status,
    })),
    errorCode: record.errorCode,
  }
}

async function writeJobRecord(
  supabase: SupabaseClient,
  patientId: string,
  record: AsyncExportJobRecord,
): Promise<void> {
  const path = asyncExportStatusPath(patientId, record.jobId)
  const body = Buffer.from(JSON.stringify(record), 'utf8')
  const { error } = await supabase.storage.from(PATIENT_DOCUMENTS_BUCKET).upload(path, body, {
    contentType: 'application/json',
    upsert: true,
  })
  if (error) {
    throw new Error('async_export_status_write_failed')
  }
}

export async function readAsyncExportJob(
  supabase: SupabaseClient,
  patientId: string,
  jobId: string,
): Promise<AsyncExportJobRecord | null> {
  const path = asyncExportStatusPath(patientId, jobId)
  const { data, error } = await supabase.storage.from(PATIENT_DOCUMENTS_BUCKET).download(path)
  if (error || !data) return null
  try {
    const text = await data.text()
    const parsed = JSON.parse(text) as AsyncExportJobRecord
    if (parsed?.v !== 1 || parsed.jobId !== jobId) return null
    return parsed
  } catch {
    return null
  }
}

export function createAsyncExportJobRecord(
  patientId: string,
  rows: DicomExportRow[],
  nowMs: number = Date.now(),
): AsyncExportJobRecord | { error: 'empty' } {
  const partsResolved = buildAsyncStudyExportParts(rows)
  if (partsResolved.length === 0) return { error: 'empty' }

  const jobId = randomUUID()
  const createdAt = new Date(nowMs).toISOString()
  const expiresAt = new Date(nowMs + ASYNC_EXPORT_JOB_TTL_MS).toISOString()
  const fileCount = partsResolved.reduce((sum, p) => sum + p.fileCount, 0)
  const totalBytes = partsResolved.reduce((sum, p) => sum + p.totalBytes, 0)
  const seriesCount = partsResolved.reduce((sum, p) => sum + p.seriesCount, 0)

  return {
    v: 1,
    jobId,
    patientIdHash: hashSeriesUid(patientId) ?? 'unknown',
    status: 'queued',
    createdAt,
    updatedAt: createdAt,
    expiresAt,
    fileCount,
    seriesCount,
    totalBytes,
    partCount: partsResolved.length,
    completedParts: 0,
    parts: partsResolved.map((p, index) => ({
      index,
      fileCount: p.fileCount,
      seriesCount: p.seriesCount,
      totalBytes: p.totalBytes,
      storagePath: null,
      status: 'pending',
    })),
  }
}

export async function persistNewAsyncExportJob(
  supabase: SupabaseClient,
  patientId: string,
  record: AsyncExportJobRecord,
): Promise<AsyncExportJobPublic> {
  await writeJobRecord(supabase, patientId, record)
  return toPublic(record)
}

function isExpired(record: AsyncExportJobRecord, nowMs: number = Date.now()): boolean {
  return Date.parse(record.expiresAt) <= nowMs
}

/**
 * Supprime tous les objets d’un job (`status.json` + parties ZIP).
 * Compteurs uniquement — pas de paths / PHI dans le retour.
 */
export async function deleteAsyncExportJobObjects(
  supabase: SupabaseClient,
  patientId: string,
  jobId: string,
  options: { dryRun?: boolean } = {},
): Promise<{ objectsFound: number; objectsDeleted: number; deleteErrors: number }> {
  const prefix = asyncExportJobPrefix(patientId, jobId)
  const { data: entries, error } = await supabase.storage
    .from(PATIENT_DOCUMENTS_BUCKET)
    .list(prefix, { limit: 100 })

  if (error || !entries) {
    return { objectsFound: 0, objectsDeleted: 0, deleteErrors: 1 }
  }

  const paths = entries
    .filter((e) => Boolean(e.name) && e.id != null)
    .map((e) => `${prefix}/${e.name}`)

  if (paths.length === 0) {
    return { objectsFound: 0, objectsDeleted: 0, deleteErrors: 0 }
  }

  if (options.dryRun) {
    return { objectsFound: paths.length, objectsDeleted: 0, deleteErrors: 0 }
  }

  const { error: removeError } = await supabase.storage
    .from(PATIENT_DOCUMENTS_BUCKET)
    .remove(paths)

  if (removeError) {
    return { objectsFound: paths.length, objectsDeleted: 0, deleteErrors: 1 }
  }
  return { objectsFound: paths.length, objectsDeleted: paths.length, deleteErrors: 0 }
}

export type CleanupAsyncExportsResult = {
  dryRun: boolean
  patientPrefixesScanned: number
  jobsScanned: number
  jobsExpired: number
  objectsDeleted: number
  listErrors: number
  deleteErrors: number
  truncated: boolean
}

type StorageListEntry = {
  name: string
  id: string | null
  updated_at?: string | null
  created_at?: string | null
}

async function listStoragePrefix(
  supabase: SupabaseClient,
  prefix: string,
): Promise<{ entries: StorageListEntry[]; error: boolean }> {
  const { data, error } = await supabase.storage
    .from(PATIENT_DOCUMENTS_BUCKET)
    .list(prefix, { limit: 1000, offset: 0, sortBy: { column: 'name', order: 'asc' } })
  if (error || !data) return { entries: [], error: true }
  return {
    entries: data.map((e) => ({
      name: e.name,
      id: e.id ?? null,
      updated_at: e.updated_at,
      created_at: e.created_at,
    })),
    error: false,
  }
}

function entryLooksLikeFolder(entry: StorageListEntry): boolean {
  // Dossiers Storage : pas d’id fichier ; ou nom UUID / job sans extension.
  return entry.id == null || !entry.name.includes('.')
}

function jobExpiredFromRecordOrObjects(
  record: AsyncExportJobRecord | null,
  objects: StorageListEntry[],
  nowMs: number,
): boolean {
  if (record) return isExpired(record, nowMs)

  // Orphelin sans status.json : TTL depuis la plus récente mtime connue.
  const stamps = objects
    .map((o) => Date.parse(o.updated_at || o.created_at || ''))
    .filter((t) => Number.isFinite(t))
  if (stamps.length === 0) return true
  const newest = Math.max(...stamps)
  return newest + ASYNC_EXPORT_JOB_TTL_MS <= nowMs
}

/**
 * Parcourt `exports/{patientId}/{jobId}/` et supprime les jobs au-delà du TTL (2 h).
 * Réponse = compteurs uniquement (pas de patientId / jobId / paths).
 */
export async function cleanupExpiredAsyncExports(
  supabase: SupabaseClient,
  options: {
    dryRun?: boolean
    maxJobs?: number
    nowMs?: number
  } = {},
): Promise<CleanupAsyncExportsResult> {
  const dryRun = Boolean(options.dryRun)
  const maxJobs = Math.min(
    Math.max(1, options.maxJobs ?? ASYNC_EXPORT_CLEANUP_DEFAULT_MAX_JOBS),
    ASYNC_EXPORT_CLEANUP_MAX_JOBS,
  )
  const nowMs = options.nowMs ?? Date.now()

  const result: CleanupAsyncExportsResult = {
    dryRun,
    patientPrefixesScanned: 0,
    jobsScanned: 0,
    jobsExpired: 0,
    objectsDeleted: 0,
    listErrors: 0,
    deleteErrors: 0,
    truncated: false,
  }

  const root = await listStoragePrefix(supabase, ASYNC_EXPORT_STORAGE_ROOT)
  if (root.error) {
    result.listErrors += 1
    return result
  }

  const patientFolders = root.entries.filter(
    (e) => entryLooksLikeFolder(e) && STORAGE_UUID_FOLDER_RE.test(e.name),
  )
  result.patientPrefixesScanned = patientFolders.length

  for (const patient of patientFolders) {
    if (result.jobsScanned >= maxJobs) {
      result.truncated = true
      break
    }

    const patientPrefix = `${ASYNC_EXPORT_STORAGE_ROOT}/${patient.name}`
    const jobsList = await listStoragePrefix(supabase, patientPrefix)
    if (jobsList.error) {
      result.listErrors += 1
      continue
    }

    const jobFolders = jobsList.entries.filter(
      (e) => entryLooksLikeFolder(e) && STORAGE_UUID_FOLDER_RE.test(e.name),
    )

    for (const job of jobFolders) {
      if (result.jobsScanned >= maxJobs) {
        result.truncated = true
        break
      }
      result.jobsScanned += 1

      const jobId = job.name
      const patientId = patient.name
      const record = await readAsyncExportJob(supabase, patientId, jobId)
      const jobPrefix = asyncExportJobPrefix(patientId, jobId)
      const objectsList = await listStoragePrefix(supabase, jobPrefix)
      if (objectsList.error) {
        result.listErrors += 1
        continue
      }

      if (!jobExpiredFromRecordOrObjects(record, objectsList.entries, nowMs)) {
        continue
      }

      result.jobsExpired += 1
      const del = await deleteAsyncExportJobObjects(supabase, patientId, jobId, { dryRun })
      result.deleteErrors += del.deleteErrors
      // dry-run : objectsDeleted = objets qui auraient été effacés
      result.objectsDeleted += dryRun ? del.objectsFound : del.objectsDeleted
    }
  }

  return result
}

export async function getAsyncExportJobPublic(
  supabase: SupabaseClient,
  patientId: string,
  jobId: string,
  options: { includeSignedUrls?: boolean } = {},
): Promise<AsyncExportJobPublic | { error: 'not_found' | 'expired' }> {
  const record = await readAsyncExportJob(supabase, patientId, jobId)
  if (!record) return { error: 'not_found' }
  if (isExpired(record)) {
    // Best-effort : ne bloque pas la réponse 410.
    void deleteAsyncExportJobObjects(supabase, patientId, jobId).catch(() => undefined)
    return { error: 'expired' }
  }

  const pub = toPublic(record)
  if (!options.includeSignedUrls) return pub

  const readyParts = record.parts.filter((p) => p.status === 'ready' && p.storagePath)
  if (readyParts.length === 0) return pub

  const downloads: NonNullable<AsyncExportJobPublic['downloads']> = []
  for (const part of readyParts) {
    const path = part.storagePath!
    const { data, error } = await supabase.storage
      .from(PATIENT_DOCUMENTS_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
    if (error || !data?.signedUrl) continue
    downloads.push({
      index: part.index,
      filename:
        record.partCount > 1
          ? `etude-dicom-part${part.index + 1}of${record.partCount}.zip`
          : 'etude-dicom.zip',
      signedUrl: data.signedUrl,
      expiresInSeconds: SIGNED_URL_TTL_SECONDS,
    })
  }
  if (downloads.length > 0) pub.downloads = downloads
  return pub
}

/**
 * Matérialise une partie (0-index) vers Storage. Idempotent si déjà ready.
 */
export async function buildAsyncExportPart(
  supabase: SupabaseClient,
  patientId: string,
  jobId: string,
  partIndex: number,
  rows: DicomExportRow[],
): Promise<AsyncExportJobPublic | { error: string; status?: number }> {
  const record = await readAsyncExportJob(supabase, patientId, jobId)
  if (!record) return { error: 'not_found', status: 404 }
  if (isExpired(record)) {
    void deleteAsyncExportJobObjects(supabase, patientId, jobId).catch(() => undefined)
    return { error: 'expired', status: 410 }
  }

  if (!Number.isInteger(partIndex) || partIndex < 0 || partIndex >= record.partCount) {
    return { error: 'part_out_of_range', status: 400 }
  }

  const existing = record.parts[partIndex]
  if (!existing) return { error: 'part_out_of_range', status: 400 }
  if (existing.status === 'ready' && existing.storagePath) {
    return toPublic(record)
  }

  const partsResolved = buildAsyncStudyExportParts(rows)
  const resolved: ResolvedDicomExport | undefined = partsResolved[partIndex]
  if (!resolved) return { error: 'part_out_of_range', status: 400 }

  record.status = 'building'
  record.updatedAt = new Date().toISOString()
  await writeJobRecord(supabase, patientId, record)

  try {
    const buffer = await bufferDicomZip(resolved.entries, (path) =>
      downloadPatientDocumentBlob(supabase, path),
    )
    const storagePath = asyncExportPartPath(patientId, jobId, partIndex)
    const { error: uploadError } = await supabase.storage
      .from(PATIENT_DOCUMENTS_BUCKET)
      .upload(storagePath, buffer, {
        contentType: 'application/zip',
        upsert: true,
      })
    if (uploadError) {
      throw new Error('async_export_upload_failed')
    }

    existing.status = 'ready'
    existing.storagePath = storagePath
    existing.fileCount = resolved.fileCount
    existing.seriesCount = resolved.seriesCount
    existing.totalBytes = resolved.totalBytes
    delete existing.errorCode

    record.completedParts = record.parts.filter((p) => p.status === 'ready').length
    record.status = record.completedParts >= record.partCount ? 'ready' : 'building'
    record.updatedAt = new Date().toISOString()
    await writeJobRecord(supabase, patientId, record)
    return toPublic(record)
  } catch {
    existing.status = 'error'
    existing.errorCode = 'build_failed'
    record.status = 'error'
    record.errorCode = 'build_failed'
    record.updatedAt = new Date().toISOString()
    await writeJobRecord(supabase, patientId, record)
    return { error: 'build_failed', status: 500 }
  }
}
