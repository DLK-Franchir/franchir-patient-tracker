'use client'

import { ArrowLeft, ArrowRight, Download, X } from 'lucide-react'
import type { ViewerInfoKind } from '../contract'
import { VIEWER_ACCENT } from './messages'
import { ViewerInfoBubble } from './viewer-info-bubble'

export type DicomSeriesHeaderProps = {
  name: string
  seriesCount: number
  activeSeriesIndex: number
  isBusy: boolean
  infoKind: ViewerInfoKind
  sliceCount: number
  fileCount: number
  errorMessage?: string | null
  infoNote?: string | null
  preloadLoaded?: number
  preloadMode?: boolean
  onPrevSeries?: () => void
  onNextSeries?: () => void
  onClose?: () => void
  /** ZIP .dcm de la série ouverte (Horos / RadiAnt…). */
  onDownloadSeries?: () => void | Promise<void>
  /** ZIP étude (toutes séries image). */
  onDownloadStudy?: () => void | Promise<void>
  downloadBusy?: boolean
}

export function DicomSeriesHeader({
  name,
  seriesCount,
  activeSeriesIndex,
  isBusy,
  infoKind,
  sliceCount,
  fileCount,
  errorMessage,
  infoNote,
  preloadLoaded,
  preloadMode,
  onPrevSeries,
  onNextSeries,
  onClose,
  onDownloadSeries,
  onDownloadStudy,
  downloadBusy = false,
}: DicomSeriesHeaderProps) {
  const hasSeriesNav = seriesCount > 1 && onNextSeries && onPrevSeries
  const atFirstSeries = activeSeriesIndex <= 0
  const atLastSeries = seriesCount > 0 ? activeSeriesIndex >= seriesCount - 1 : true
  const exportDisabled = isBusy || downloadBusy

  return (
    <div
      className="flex shrink-0 flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3"
      data-testid="dicom-series-header"
    >
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-white">{name}</p>
          {seriesCount > 1 ? (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium tabular-nums text-white/60">
              Série {activeSeriesIndex + 1} / {seriesCount}
            </span>
          ) : null}
        </div>
        <ViewerInfoBubble
          kind={infoKind}
          sliceCount={sliceCount}
          fileCount={fileCount}
          errorMessage={errorMessage}
          infoNote={infoNote}
          preloadLoaded={preloadLoaded}
          preloadTotal={fileCount}
          preloadMode={preloadMode}
        />
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {onDownloadSeries ? (
          <button
            type="button"
            onClick={() => void onDownloadSeries()}
            disabled={exportDisabled}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
            data-testid="dicom-download-series"
            title="Télécharger la série (DICOM brut, ZIP)"
          >
            <Download className="size-4" aria-hidden="true" />
            {downloadBusy ? 'Export…' : 'Télécharger la série'}
          </button>
        ) : null}
        {onDownloadStudy ? (
          <button
            type="button"
            onClick={() => void onDownloadStudy()}
            disabled={exportDisabled}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
            data-testid="dicom-download-study"
            title="Télécharger l etude (toutes les series image)"
          >
            <Download className="size-4" aria-hidden="true" />
            Étude
          </button>
        ) : null}
        {hasSeriesNav ? (
          <>
            <button
              type="button"
              onClick={onPrevSeries}
              disabled={atFirstSeries || isBusy}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
              data-testid="dicom-prev-series"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Série préc.
            </button>
            <button
              type="button"
              onClick={onNextSeries}
              disabled={atLastSeries || isBusy}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-lg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              style={{ backgroundColor: VIEWER_ACCENT }}
              data-testid="dicom-next-series"
            >
              {isBusy ? 'Chargement…' : 'Série suivante'}
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          </>
        ) : null}
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la visionneuse"
            className="inline-flex items-center justify-center rounded-lg p-2 text-white/80 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  )
}
