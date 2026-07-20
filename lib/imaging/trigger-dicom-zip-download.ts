/**
 * Déclenche le téléchargement d'un ZIP streamé par l'API (même origine, cookies session).
 * Pas de mint d'URLs signées côté client.
 */

export function triggerDicomZipDownload(url: string): void {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

export function seriesExportZipUrl(patientId: string, seriesKey: string): string {
  return `/api/patients/${patientId}/imaging/series/${encodeURIComponent(seriesKey)}/export.zip`
}

export function studyExportZipUrl(patientId: string): string {
  return `/api/patients/${patientId}/imaging/study/export.zip`
}
