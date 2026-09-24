'use client'

import { formatSeriesOverlayLabel, formatWindowLevelOverlay } from '../policy'

export type DicomCornerOverlayProps = {
  modality?: string | null
  description?: string | null
  sliceIndex: number
  sliceTotal: number
  windowLevel?: { center: number; width: number } | null
  inverted?: boolean
  /** Libellé de la position dans la série (`coupe` en stack, `fichier` en séquentiel). */
  unit?: 'coupe' | 'fichier'
}

const CORNER =
  'pointer-events-none absolute select-none rounded bg-black/35 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white/85 backdrop-blur-[2px]'

/**
 * Overlay 4 coins (U0) — non-PHI : modality / description, coupe n / N, W/L.
 * Pas de nom patient ni d'UID : la fiche patient porte déjà l'identité.
 */
export function DicomCornerOverlay({
  modality,
  description,
  sliceIndex,
  sliceTotal,
  windowLevel,
  inverted = false,
  unit = 'coupe',
}: DicomCornerOverlayProps) {
  const seriesLabel = formatSeriesOverlayLabel({ modality, description })
  const wlLabel = formatWindowLevelOverlay(windowLevel)
  const showSlice = sliceTotal > 1

  return (
    <div
      className="pointer-events-none absolute inset-0"
      data-testid="dicom-corner-overlay"
      aria-hidden="true"
    >
      {seriesLabel ? (
        <span
          className={`${CORNER} left-2 top-2 max-w-[60%] truncate`}
          data-testid="dicom-overlay-series"
        >
          {seriesLabel}
        </span>
      ) : null}
      {inverted ? (
        <span className={`${CORNER} right-2 top-2`} data-testid="dicom-overlay-invert">
          Inversé
        </span>
      ) : null}
      {showSlice ? (
        <span className={`${CORNER} bottom-2 left-2`} data-testid="dicom-overlay-slice">
          {unit === 'fichier' ? 'Fichier' : 'Coupe'} {sliceIndex + 1} / {sliceTotal}
        </span>
      ) : null}
      {wlLabel ? (
        <span className={`${CORNER} bottom-2 right-2`} data-testid="dicom-overlay-wl">
          {wlLabel}
        </span>
      ) : null}
    </div>
  )
}
