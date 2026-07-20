/**
 * Backfill one-shot des colonnes DICOM de patient_documents (legacy sans SUID).
 * Lit l'en-tête Storage (Range ~96 Ko), extrait les métadonnées, UPDATE.
 *
 * Pas de suppression / dédup ici (réservé au script CLI). Pas de PHI dans les
 * logs : uniquement des compteurs + patientId.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { extractDicomPersistedMetadata } from '@/lib/imaging/dicom-content'

export const PATIENT_DOCUMENTS_BUCKET = 'patient-documents'
export const BACKFILL_HEADER_RANGE_BYTES = 96 * 1024
export const BACKFILL_DEFAULT_LIMIT = 500
export const BACKFILL_MAX_LIMIT = 2000
const DOWNLOAD_CONCURRENCY = 6

export type BackfillDicomMetadataOptions = {
  patientId: string
  dryRun?: boolean
  /** Max rows to scan (default 500, hard cap 2000). */
  limit?: number
  /** Only rows missing series_instance_uid (default true). */
  missingSeriesOnly?: boolean
}

export type BackfillDicomMetadataResult = {
  patientId: string
  dryRun: boolean
  scanned: number
  parseOk: number
  parseFailed: number
  updated: number
  skipped: number
}

type DocRow = {
  id: string
  file_path: string
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next
      next += 1
      out[i] = await fn(items[i]!, i)
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  await Promise.all(workers)
  return out
}

async function fetchHeaderBytes(
  supabase: SupabaseClient,
  filePath: string,
): Promise<ArrayBuffer | null> {
  const { data: signed, error: signErr } = await supabase.storage
    .from(PATIENT_DOCUMENTS_BUCKET)
    .createSignedUrl(filePath, 120)
  if (signErr || !signed?.signedUrl) return null

  try {
    const res = await fetch(signed.signedUrl, {
      headers: { Range: `bytes=0-${BACKFILL_HEADER_RANGE_BYTES - 1}` },
    })
    if (!res.ok && res.status !== 206) return null
    return res.arrayBuffer()
  } catch {
    return null
  }
}

/**
 * Remplit series_instance_uid (+ SOP / description / instance) pour les DICOM
 * legacy d'un patient. Idempotent : ne touche pas les lignes déjà pourvues
 * quand missingSeriesOnly=true.
 */
export async function backfillPatientDicomMetadata(
  supabase: SupabaseClient,
  options: BackfillDicomMetadataOptions,
): Promise<BackfillDicomMetadataResult> {
  const dryRun = options.dryRun === true
  const missingSeriesOnly = options.missingSeriesOnly !== false
  const limit = Math.min(
    Math.max(1, options.limit ?? BACKFILL_DEFAULT_LIMIT),
    BACKFILL_MAX_LIMIT,
  )

  let query = supabase
    .from('patient_documents')
    .select('id, file_path')
    .eq('patient_id', options.patientId)
    .eq('kind', 'dicom')
    .order('created_at', { ascending: true })
    .limit(limit)

  if (missingSeriesOnly) {
    query = query.is('series_instance_uid', null)
  }

  const { data: rows, error } = await query
  if (error) {
    throw new Error(`backfill_list_failed:${error.message}`)
  }

  const list = (rows ?? []) as DocRow[]
  let updated = 0
  let skipped = 0

  const metas = await mapPool(list, DOWNLOAD_CONCURRENCY, async (row) => {
    const buf = await fetchHeaderBytes(supabase, row.file_path)
    if (!buf) return null
    const meta = extractDicomPersistedMetadata(buf)
    if (!meta?.seriesInstanceUid && !meta?.sopInstanceUid) return null
    return meta
  })

  const parseOk = metas.filter(Boolean).length
  const parseFailed = list.length - parseOk

  for (let i = 0; i < list.length; i += 1) {
    const row = list[i]!
    const meta = metas[i]
    if (!meta) {
      skipped += 1
      continue
    }
    if (dryRun) {
      updated += 1
      continue
    }
    const { error: upErr } = await supabase
      .from('patient_documents')
      .update({
        sop_instance_uid: meta.sopInstanceUid,
        series_instance_uid: meta.seriesInstanceUid,
        series_description: meta.seriesDescription,
        body_part: meta.bodyPart,
        instance_number: meta.instanceNumber,
        acquisition_datetime: meta.acquisitionDatetime,
      })
      .eq('id', row.id)
    if (upErr) {
      skipped += 1
    } else {
      updated += 1
    }
  }

  return {
    patientId: options.patientId,
    dryRun,
    scanned: list.length,
    parseOk,
    parseFailed,
    updated,
    skipped,
  }
}
