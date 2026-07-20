/**
 * Déclenche le téléchargement d'un ZIP streamé par l'API (même origine, cookies session).
 * Étude Fatima-scale : plan → ZIP unique ou multi-parties (`?part=N`).
 */

import {
  emitImagingTelemetry,
  nowMs,
  type DicomExportReason,
  type ImagingTelemetryHandler,
} from '@franchir/imaging-viewer'

/** Raisons sync déjà câblées — P7 async = `study_async*` (mêmes noms d’événement). */
type SyncExportReason = Extract<
  DicomExportReason,
  | 'series'
  | 'series_fail'
  | 'study_single'
  | 'study_single_fail'
  | 'study_chunked'
  | 'study_chunk_fail'
  | 'study_plan_fail'
  | 'study_download_fail'
>
import { studyTooLargeFallbackMessage } from '@franchir/imaging-viewer/ui/card-actions'

export type DicomZipDownloadResult =
  | { ok: true; mode?: 'single' | 'chunked'; partCount?: number }
  | { ok: false; status: number; message: string; hint?: string }

export type StudyExportPlanResponse =
  | {
      mode: 'single'
      fileCount: number
      seriesCount: number
      totalBytes: number
      partCount: 1
    }
  | {
      mode: 'chunked'
      fileCount: number
      seriesCount: number
      totalBytes: number
      partCount: number
      maxFiles: number
      parts: Array<{ index: number; fileCount: number; seriesCount: number; totalBytes: number }>
    }

const STUDY_TOO_LARGE_MSG = studyTooLargeFallbackMessage()

const PART_GAP_MS = 350

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function saveBlobDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000)
}

export async function downloadDicomZip(url: string): Promise<DicomZipDownloadResult> {
  try {
    const res = await fetch(url, { credentials: 'same-origin', cache: 'no-store' })
    if (res.status === 413) {
      const data = (await res.json().catch(() => ({}))) as {
        message?: string
        hint?: string
      }
      return {
        ok: false,
        status: 413,
        message: data.message || STUDY_TOO_LARGE_MSG,
        hint: data.hint,
      }
    }
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
      return {
        ok: false,
        status: res.status,
        message: data.message || data.error || `Échec du téléchargement (${res.status})`,
      }
    }
    const blob = await res.blob()
    const disposition = res.headers.get('Content-Disposition') || ''
    const match = /filename\*?=(?:UTF-8''|")?([^\";]+)/i.exec(disposition)
    const filename = match?.[1] ? decodeURIComponent(match[1].replace(/"/g, '')) : 'export-dicom.zip'
    saveBlobDownload(blob, filename)
    return { ok: true }
  } catch {
    return { ok: false, status: 0, message: 'Impossible de télécharger le ZIP.' }
  }
}

export type StudyDownloadProgress = {
  completed: number
  total: number
  mode: 'single' | 'chunked'
}

/**
 * Export étude : consulte le plan, puis ZIP unique ou parties séquentielles.
 */
export async function downloadStudyDicomExport(options: {
  planUrl: string
  studyZipUrl: (partIndex?: number) => string
  onProgress?: (progress: StudyDownloadProgress) => void
  onTelemetry?: ImagingTelemetryHandler
}): Promise<DicomZipDownloadResult> {
  const started = nowMs()
  const { planUrl, studyZipUrl, onProgress, onTelemetry } = options

  try {
    const planRes = await fetch(planUrl, { credentials: 'same-origin', cache: 'no-store' })
    if (!planRes.ok) {
      const data = (await planRes.json().catch(() => ({}))) as { error?: string; message?: string }
      const result: DicomZipDownloadResult = {
        ok: false,
        status: planRes.status,
        message: data.message || data.error || `Échec du plan d'export (${planRes.status})`,
      }
      const reason: SyncExportReason = 'study_plan_fail'
      emitImagingTelemetry(onTelemetry, {
        name: 'dicom_export',
        durationMs: nowMs() - started,
        outcome: 'error',
        reason,
      })
      return result
    }

    const plan = (await planRes.json()) as StudyExportPlanResponse
    if (plan.mode !== 'single' && plan.mode !== 'chunked') {
      return { ok: false, status: 500, message: 'Plan d’export invalide.' }
    }

    const partCount = plan.mode === 'single' ? 1 : Math.max(1, plan.partCount)
    onProgress?.({ completed: 0, total: partCount, mode: plan.mode })

    for (let i = 0; i < partCount; i += 1) {
      const url = plan.mode === 'single' ? studyZipUrl() : studyZipUrl(i)
      const partResult = await downloadDicomZip(url)
      if (!partResult.ok) {
        const reason: SyncExportReason =
          plan.mode === 'chunked' ? 'study_chunk_fail' : 'study_single_fail'
        emitImagingTelemetry(onTelemetry, {
          name: 'dicom_export',
          durationMs: nowMs() - started,
          fileCount: plan.fileCount,
          outcome: 'error',
          reason,
        })
        return partResult
      }
      onProgress?.({ completed: i + 1, total: partCount, mode: plan.mode })
      if (i + 1 < partCount) await sleep(PART_GAP_MS)
    }

    const readyReason: SyncExportReason =
      plan.mode === 'chunked' ? 'study_chunked' : 'study_single'
    emitImagingTelemetry(onTelemetry, {
      name: 'dicom_export',
      durationMs: nowMs() - started,
      fileCount: plan.fileCount,
      outcome: 'ready',
      reason: readyReason,
    })

    return { ok: true, mode: plan.mode, partCount }
  } catch {
    const reason: SyncExportReason = 'study_download_fail'
    emitImagingTelemetry(onTelemetry, {
      name: 'dicom_export',
      durationMs: nowMs() - started,
      outcome: 'error',
      reason,
    })
    return { ok: false, status: 0, message: 'Impossible de télécharger le ZIP étude.' }
  }
}

/** Téléchargement série + télémétrie non-PHI. */
export async function downloadSeriesDicomExport(options: {
  url: string
  fileCount?: number
  onTelemetry?: ImagingTelemetryHandler
}): Promise<DicomZipDownloadResult> {
  const started = nowMs()
  const result = await downloadDicomZip(options.url)
  const reason: SyncExportReason = result.ok ? 'series' : 'series_fail'
  emitImagingTelemetry(options.onTelemetry, {
    name: 'dicom_export',
    durationMs: nowMs() - started,
    fileCount: options.fileCount,
    outcome: result.ok ? 'ready' : 'error',
    reason,
  })
  return result
}

/** @deprecated Prefer downloadDicomZip for 413 feedback. Kept for simple fire-and-forget. */
export function triggerDicomZipDownload(url: string): void {
  void downloadDicomZip(url)
}

export function seriesExportZipUrl(patientId: string, seriesKey: string): string {
  return `/api/patients/${patientId}/imaging/series/${encodeURIComponent(seriesKey)}/export.zip`
}

export function studyExportZipUrl(patientId: string, partIndex?: number): string {
  const base = `/api/patients/${patientId}/imaging/study/export.zip`
  if (partIndex == null) return base
  return `${base}?part=${partIndex}`
}

export function studyExportPlanUrl(patientId: string): string {
  return `/api/patients/${patientId}/imaging/study/export-plan`
}
