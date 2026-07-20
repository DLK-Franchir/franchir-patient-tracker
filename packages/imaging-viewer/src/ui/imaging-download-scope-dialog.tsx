'use client'

import { useEffect, useId, useRef } from 'react'

export type ImagingDownloadScope = 'series' | 'study'

export type ImagingDownloadScopeDialogProps = {
  open: boolean
  /** Label of the series/sequence being offered (non-PHI display name). */
  itemLabel: string
  busy?: boolean
  /** Visible status while ZIP is preparing / streaming (non-PHI). */
  busyMessage?: string
  /** When false, only the whole-study option is shown (e.g. non-DICOM file). */
  offerSeries?: boolean
  seriesLabel?: string
  studyLabel?: string
  onSelect: (scope: ImagingDownloadScope) => void
  onCancel: () => void
}

/**
 * Choix de portée avant export ZIP : cette série/séquence ou l'intégralité de l'étude.
 * Modale accessible, indépendante de Radix — utilisée sur cartes grille et chrome viewer.
 */
export function ImagingDownloadScopeDialog({
  open,
  itemLabel,
  busy = false,
  busyMessage = 'Téléchargement en cours…',
  offerSeries = true,
  seriesLabel = 'Cette série / séquence',
  studyLabel = "L'intégralité de l'étude",
  onSelect,
  onCancel,
}: ImagingDownloadScopeDialogProps) {
  const titleId = useId()
  const descId = useId()
  const firstBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    firstBtnRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [open, busy, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        data-testid="imaging-download-scope-dialog"
        className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
      >
        <h2 id={titleId} className="text-base font-semibold text-gray-900">
          Télécharger
        </h2>
        <p id={descId} className="mt-1 text-sm text-gray-600">
          Que souhaitez-vous télécharger pour « {itemLabel} » ?
        </p>
        {busy ? (
          <p
            className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700"
            data-testid="imaging-download-scope-busy"
            aria-live="polite"
          >
            {busyMessage}
          </p>
        ) : null}
        <div className="mt-4 flex flex-col gap-2">
          {offerSeries ? (
            <button
              ref={firstBtnRef}
              type="button"
              disabled={busy}
              data-testid="imaging-download-scope-series"
              onClick={() => onSelect('series')}
              className="min-h-[48px] rounded-xl bg-[#2563EB] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1d4ed8] disabled:opacity-50"
            >
              {seriesLabel}
            </button>
          ) : null}
          <button
            ref={offerSeries ? undefined : firstBtnRef}
            type="button"
            disabled={busy}
            data-testid="imaging-download-scope-study"
            onClick={() => onSelect('study')}
            className="min-h-[48px] rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
          >
            {studyLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            data-testid="imaging-download-scope-cancel"
            onClick={onCancel}
            className="min-h-[44px] rounded-xl px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}
