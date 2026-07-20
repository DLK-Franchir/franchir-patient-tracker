/**
 * Export DICOM brut (ZIP de .dcm) pour visionneuses desktop (Horos, RadiAnt…).
 * Pas de JPEG d'écran — octets Storage tels quels.
 *
 * Naming : SE###_desc/IM####.dcm (compatible OsiriX / Weasis).
 * Audit : hash UID série + counts — jamais de nom patient / email / UID brut en logs.
 */

import { createHash } from 'node:crypto'
import { PassThrough, Readable } from 'node:stream'
import type { ReadableStream as NodeWebReadableStream } from 'node:stream/web'
import archiver from 'archiver'
import type { SupabaseClient } from '@supabase/supabase-js'
import { groupDicomFilesByMetadata, type MetaImagingFile } from '@franchir/imaging'
import {
  MAX_DOCUMENTS_LISTED,
  PATIENT_DOCUMENTS_BUCKET,
} from '@/lib/documents/patient-documents'

/** Plafond série ZIP (sync) — au-delà, risque timeout Vercel. */
export const MAX_SERIES_EXPORT_FILES = 500

/**
 * Plafond étude ZIP sync. Tania ~195 OK ; Fatima ~900+ → 413 + séries unitaires.
 */
export const MAX_STUDY_EXPORT_FILES = 400

/** Estimation octets max pour une étude sync (~1.5 Go soft). */
export const MAX_STUDY_EXPORT_BYTES = 1_500_000_000

export type DicomExportRow = {
  id: string
  filePath: string
  fileName: string
  sizeBytes: number | null
  seriesInstanceUid: string | null
  seriesDescription: string | null
  bodyPart: string | null
  instanceNumber: number | null
  sopInstanceUid: string | null
  acquisitionDatetime: string | null
}

export type DicomExportZipEntry = {
  storagePath: string
  zipPath: string
  sizeBytes: number
}

export type ResolvedDicomExport = {
  entries: DicomExportZipEntry[]
  fileCount: number
  totalBytes: number
  seriesCount: number
  /** Hash court non-PHI pour audit. */
  seriesUidHash: string | null
  groupId: string
  exportKind: 'series' | 'study'
}

/** Hash court d'un SeriesInstanceUID (audit sans PHI). */
export function hashSeriesUid(uid: string | null | undefined): string | null {
  const trimmed = (uid ?? '').trim()
  if (!trimmed) return null
  return createHash('sha256').update(trimmed).digest('hex').slice(0, 16)
}

/** Sanitize fragment chemin ZIP (pas de séparateurs / caractères dangereux). */
export function sanitizeZipPathSegment(raw: string, maxLen = 48): string {
  const cleaned = raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, maxLen)
  return cleaned || 'serie'
}

/**
 * Décode le paramètre de route `seriesUid` :
 * - UID DICOM brut
 * - groupId (`suid:…`, `date:…`, `series:…`, `SE…`)
 */
export function normalizeSeriesExportKey(raw: string): { groupId: string; seriesUid: string | null } {
  const decoded = decodeURIComponent(raw).trim()
  if (!decoded) return { groupId: '', seriesUid: null }

  if (decoded.startsWith('suid:')) {
    const uid = decoded.slice('suid:'.length).trim()
    return { groupId: decoded, seriesUid: uid || null }
  }

  if (/^\d+(?:\.\d+)+$/.test(decoded)) {
    return { groupId: `suid:${decoded}`, seriesUid: decoded }
  }

  return { groupId: decoded, seriesUid: null }
}

function seriesFolderName(seriesIndex: number, description: string | null | undefined): string {
  const se = `SE${String(seriesIndex + 1).padStart(3, '0')}`
  const desc = sanitizeZipPathSegment((description ?? '').trim() || 'DICOM')
  return `${se}_${desc}`
}

function instanceFileName(instanceNumber: number | null | undefined, fallbackIndex: number): string {
  const n = instanceNumber != null && Number.isFinite(instanceNumber) ? instanceNumber : fallbackIndex + 1
  return `IM${String(Math.max(0, Math.trunc(n))).padStart(4, '0')}.dcm`
}

type ExportableFile = MetaImagingFile & {
  storagePath: string
  sizeBytes: number
  id: string
}

function toExportable(rows: DicomExportRow[]): ExportableFile[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.fileName,
    url: row.filePath,
    storagePath: row.filePath,
    size: row.sizeBytes,
    sizeBytes: row.sizeBytes ?? 0,
    seriesInstanceUid: row.seriesInstanceUid,
    seriesDescription: row.seriesDescription,
    bodyPart: row.bodyPart,
    instanceNumber: row.instanceNumber,
    sopInstanceUid: row.sopInstanceUid,
    acquisitionDatetime: row.acquisitionDatetime,
  }))
}

function buildZipEntriesForGroups(
  groups: Array<{ groupId: string; label: string; isEncapsulatedPdf: boolean; files: ExportableFile[] }>,
  options: { excludeEncapsulatedPdf: boolean },
): { entries: DicomExportZipEntry[]; seriesCount: number } {
  const entries: DicomExportZipEntry[] = []
  let seriesOrdinal = 0

  for (const group of groups) {
    if (options.excludeEncapsulatedPdf && group.isEncapsulatedPdf) continue
    const folder = seriesFolderName(seriesOrdinal, group.files[0]?.seriesDescription ?? group.label)
    seriesOrdinal += 1
    group.files.forEach((file, index) => {
      entries.push({
        storagePath: file.storagePath,
        zipPath: `${folder}/${instanceFileName(file.instanceNumber, index)}`,
        sizeBytes: file.sizeBytes,
      })
    })
  }

  return { entries, seriesCount: seriesOrdinal }
}

/**
 * Résout les fichiers Storage pour une série (groupId ou SeriesInstanceUID).
 */
export function resolveSeriesExport(
  rows: DicomExportRow[],
  seriesKey: string,
): ResolvedDicomExport | { error: 'not_found' | 'empty' | 'too_large'; fileCount?: number } {
  const { groupId: wantGroupId, seriesUid } = normalizeSeriesExportKey(seriesKey)
  if (!wantGroupId && !seriesUid) return { error: 'empty' }

  const exportable = toExportable(rows)
  if (exportable.length === 0) return { error: 'empty' }

  const groups = groupDicomFilesByMetadata(exportable)
  let matched =
    groups.find((g) => g.groupId === wantGroupId) ??
    (seriesUid
      ? groups.find((g) => g.files.some((f) => f.seriesInstanceUid === seriesUid))
      : undefined)

  if (!matched && seriesUid) {
    const byUid = exportable.filter((f) => f.seriesInstanceUid === seriesUid)
    if (byUid.length > 0) {
      matched = {
        groupId: `suid:${seriesUid}`,
        label: byUid[0]?.seriesDescription ?? 'Série DICOM',
        isEncapsulatedPdf: false,
        files: byUid,
      }
    }
  }

  if (!matched || matched.files.length === 0) return { error: 'not_found' }
  if (matched.isEncapsulatedPdf) {
    return { error: 'not_found' }
  }

  if (matched.files.length > MAX_SERIES_EXPORT_FILES) {
    return { error: 'too_large', fileCount: matched.files.length }
  }

  const { entries, seriesCount } = buildZipEntriesForGroups([matched], {
    excludeEncapsulatedPdf: true,
  })
  const totalBytes = entries.reduce((sum, e) => sum + e.sizeBytes, 0)
  const uidForHash = seriesUid ?? matched.files[0]?.seriesInstanceUid ?? matched.groupId

  return {
    entries,
    fileCount: entries.length,
    totalBytes,
    seriesCount,
    seriesUidHash: hashSeriesUid(uidForHash),
    groupId: matched.groupId,
    exportKind: 'series',
  }
}

/**
 * Résout toutes les séries image (exclut DOC PDF encapsulé).
 */
export function resolveStudyExport(
  rows: DicomExportRow[],
): ResolvedDicomExport | { error: 'empty' | 'too_large'; fileCount?: number; totalBytes?: number } {
  const exportable = toExportable(rows)
  if (exportable.length === 0) return { error: 'empty' }

  const groups = groupDicomFilesByMetadata(exportable)
  const { entries, seriesCount } = buildZipEntriesForGroups(groups, {
    excludeEncapsulatedPdf: true,
  })

  if (entries.length === 0) return { error: 'empty' }

  const totalBytes = entries.reduce((sum, e) => sum + e.sizeBytes, 0)
  if (entries.length > MAX_STUDY_EXPORT_FILES || totalBytes > MAX_STUDY_EXPORT_BYTES) {
    return { error: 'too_large', fileCount: entries.length, totalBytes }
  }

  return {
    entries,
    fileCount: entries.length,
    totalBytes,
    seriesCount,
    seriesUidHash: null,
    groupId: 'study',
    exportKind: 'study',
  }
}

/** Charge les lignes DICOM patient (chemins Storage, sans URLs signées). */
export async function loadPatientDicomExportRows(
  supabase: SupabaseClient,
  patientId: string,
): Promise<DicomExportRow[]> {
  const { data: rows, error } = await supabase
    .from('patient_documents')
    .select(
      'id, file_path, file_name, size_bytes, sop_instance_uid, series_instance_uid, series_description, body_part, instance_number, acquisition_datetime, kind',
    )
    .eq('patient_id', patientId)
    .eq('kind', 'dicom')
    .order('created_at', { ascending: true })
    .limit(MAX_DOCUMENTS_LISTED)

  if (error) {
    throw new Error('Failed to list dicom documents for export')
  }

  return (rows ?? []).map((row) => ({
    id: row.id as string,
    filePath: row.file_path as string,
    fileName: row.file_name as string,
    sizeBytes: (row.size_bytes as number | null) ?? null,
    seriesInstanceUid: (row.series_instance_uid as string | null) ?? null,
    seriesDescription: (row.series_description as string | null) ?? null,
    bodyPart: (row.body_part as string | null) ?? null,
    instanceNumber: (row.instance_number as number | null) ?? null,
    sopInstanceUid: (row.sop_instance_uid as string | null) ?? null,
    acquisitionDatetime: (row.acquisition_datetime as string | null) ?? null,
  }))
}

export type DownloadStorageObject = (path: string) => Promise<Blob | null>

/**
 * Stream ZIP (archiver) — lit Storage via service-role, sans mint d'URLs signées client.
 */
export function streamDicomZip(
  entries: DicomExportZipEntry[],
  download: DownloadStorageObject,
): ReadableStream<Uint8Array> {
  const passThrough = new PassThrough()
  const archive = archiver('zip', { zlib: { level: 0 }, store: true })

  archive.on('error', (err: Error) => {
    passThrough.destroy(err)
  })
  archive.pipe(passThrough)

  void (async () => {
    try {
      for (const entry of entries) {
        const blob = await download(entry.storagePath)
        if (!blob) continue
        const buffer = Buffer.from(await blob.arrayBuffer())
        archive.append(buffer, { name: entry.zipPath })
      }
      await archive.finalize()
    } catch (err) {
      archive.abort()
      passThrough.destroy(err instanceof Error ? err : new Error('zip_failed'))
    }
  })()

  return Readable.toWeb(passThrough) as unknown as NodeWebReadableStream<Uint8Array> as ReadableStream<Uint8Array>
}

export async function downloadPatientDocumentBlob(
  supabase: SupabaseClient,
  filePath: string,
): Promise<Blob | null> {
  const { data, error } = await supabase.storage.from(PATIENT_DOCUMENTS_BUCKET).download(filePath)
  if (error || !data) return null
  return data
}

export function dicomZipResponseHeaders(filename: string): HeadersInit {
  const safe = sanitizeZipPathSegment(filename, 80).replace(/\.zip$/i, '') || 'dicom-export'
  return {
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="${safe}.zip"`,
    'Cache-Control': 'no-store',
  }
}
