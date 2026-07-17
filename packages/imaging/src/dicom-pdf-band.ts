/**
 * Heuristique listing (sans octets) : lot DOC encapsulé sur CD DICOMS_IM.
 * Extrait de dicom-content pour le package grouping (évite la dépendance
 * parseur / magic-bytes).
 */

/** Médiane typique des DOC encapsulés sur CD DICOMS_IM. */
export const ENCAPSULATED_PDF_BAND_MAX_BYTES = 120_000

export function isLikelyEncapsulatedPdfBand(files: Array<{ size?: number | null }>): boolean {
  const sizes = files
    .map((file) => file.size)
    .filter((size): size is number => typeof size === 'number' && size > 0)
  if (sizes.length === 0) return false
  const sorted = [...sizes].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0
  return median > 0 && median <= ENCAPSULATED_PDF_BAND_MAX_BYTES
}
