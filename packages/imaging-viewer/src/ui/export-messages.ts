/**
 * UX copy for DICOM ZIP export (série / étude / multi-lots). Pas de PHI.
 */

export type ExportProgressLike = {
  completed: number
  total: number
  /** `async` = job Storage P7 (même UX multi-lots que chunked). */
  mode: 'single' | 'chunked' | 'async'
}

/** Message pendant un export étude (plan + ZIP ou lots / async). */
export function studyDownloadProgressMessage(progress: ExportProgressLike): string {
  const { completed, total, mode } = progress
  if ((mode === 'chunked' || mode === 'async') && total > 1) {
    if (completed === 0) {
      return mode === 'async'
        ? `Étude volumineuse : préparation durable de ${total} fichiers ZIP…`
        : `Étude volumineuse : préparation de ${total} fichiers ZIP…`
    }
    return mode === 'async'
      ? `Préparation de l'étude — lot ${completed}/${total}…`
      : `Téléchargement de l'étude — lot ${completed}/${total}…`
  }
  if (completed === 0) return "Préparation du téléchargement de l'étude…"
  return "Téléchargement de l'étude en cours…"
}

/** Message pendant un export série unique. */
export function seriesDownloadProgressMessage(): string {
  return 'Téléchargement de la série en cours…'
}

/**
 * Message après succès multi-ZIP (étude chunkée).
 * Horos / RadiAnt / OsiriX ouvrissent chaque lot séparément.
 */
export function studyChunkedSuccessMessage(partCount: number): string {
  const n = Math.max(1, partCount)
  if (n <= 1) {
    return "Export de l'étude terminé."
  }
  return (
    `Étude trop volumineuse pour un seul fichier : ${n} archives ZIP ont été ` +
    `téléchargées. Importez chaque lot dans Horos, RadiAnt ou OsiriX.`
  )
}

/** Message 413 / study_too_large avant bascule lots (fallback si l'API ne fournit pas de texte). */
export function studyTooLargeFallbackMessage(): string {
  return (
    "Étude trop volumineuse pour un export unique. " +
    'Téléchargement par lots (plusieurs ZIP)…'
  )
}

/** Message 410 job async expiré (TTL Storage 2 h). */
export function studyAsyncExpiredMessage(): string {
  return "L'export a expiré (délai 2 h). Relancez le téléchargement de l'étude."
}
