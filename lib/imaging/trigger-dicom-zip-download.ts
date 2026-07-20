/**
 * Déclenche le téléchargement d'un ZIP streamé par l'API (même origine, cookies session).
 * Fetch + blob pour remonter 413 (étude trop volumineuse) au lieu d'un téléchargement silencieux.
 */

export type DicomZipDownloadResult =
  | { ok: true }
  | { ok: false; status: number; message: string; hint?: string }

const STUDY_TOO_LARGE_MSG =
  'Étude trop volumineuse pour un export unique. Téléchargez chaque série séparément.'

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
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = filename
    anchor.rel = 'noopener'
    anchor.style.display = 'none'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000)
    return { ok: true }
  } catch {
    return { ok: false, status: 0, message: 'Impossible de télécharger le ZIP.' }
  }
}

/** @deprecated Prefer downloadDicomZip for 413 feedback. Kept for simple fire-and-forget. */
export function triggerDicomZipDownload(url: string): void {
  void downloadDicomZip(url)
}

export function seriesExportZipUrl(patientId: string, seriesKey: string): string {
  return `/api/patients/${patientId}/imaging/series/${encodeURIComponent(seriesKey)}/export.zip`
}

export function studyExportZipUrl(patientId: string): string {
  return `/api/patients/${patientId}/imaging/study/export.zip`
}
