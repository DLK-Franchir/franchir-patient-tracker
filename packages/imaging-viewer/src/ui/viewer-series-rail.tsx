'use client'

import { Layers, X } from 'lucide-react'
import type { ImagingSeries } from '../contract'
import { normalizeModality } from '../policy'
import { VIEWER_ACCENT, VIEWER_BG } from './messages'

export type DicomSeriesRailProps = {
  series: ImagingSeries[]
  activeIndex: number
  /** Désactive les clics pendant un chargement (évite les ouvertures en rafale). */
  busy?: boolean
  onSelect: (index: number) => void
  /** `rail` = colonne desktop ; `sheet` = panneau mobile plein écran. */
  variant: 'rail' | 'sheet'
  onClose?: () => void
}

function SeriesRailItem({
  item,
  index,
  active,
  busy,
  onSelect,
}: {
  item: ImagingSeries
  index: number
  active: boolean
  busy: boolean
  onSelect: (index: number) => void
}) {
  const modality = normalizeModality(item.modality)
  const description = (item.description ?? '').trim()
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(index)}
        disabled={busy || active}
        aria-current={active ? 'true' : undefined}
        className="flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition hover:bg-white/10 disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        style={{
          backgroundColor: active ? 'rgba(56,178,172,0.22)' : undefined,
          borderLeft: `3px solid ${active ? VIEWER_ACCENT : 'transparent'}`,
          opacity: busy && !active ? 0.6 : 1,
        }}
        data-testid="dicom-series-rail-item"
      >
        <span className="mt-0.5 inline-flex min-w-7 shrink-0 items-center justify-center rounded bg-white/10 px-1 py-0.5 text-[10px] font-semibold tabular-nums text-white/80">
          {index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium text-white">{item.label}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-white/55">
            {modality ? (
              <span className="rounded bg-white/10 px-1 py-px font-semibold text-white/80">
                {modality}
              </span>
            ) : null}
            {description && description !== item.label ? (
              <span className="truncate">{description}</span>
            ) : null}
            <span className="tabular-nums">
              {item.fileCount} {item.fileCount > 1 ? 'fichiers' : 'fichier'}
            </span>
          </span>
        </span>
      </button>
    </li>
  )
}

/**
 * Rail séries (U0) : saut direct vers une série sans défiler « suivante »
 * onze fois. Même liste sur le host dwv et le repli OpenJPEG.
 */
export function DicomSeriesRail({
  series,
  activeIndex,
  busy = false,
  onSelect,
  variant,
  onClose,
}: DicomSeriesRailProps) {
  if (series.length <= 1) return null

  const list = (
    <ul className="flex flex-col gap-0.5 p-2" role="list" aria-label="Séries de l'étude">
      {series.map((item, index) => (
        <SeriesRailItem
          key={item.id}
          item={item}
          index={index}
          active={index === activeIndex}
          busy={busy}
          onSelect={i => {
            onSelect(i)
            onClose?.()
          }}
        />
      ))}
    </ul>
  )

  if (variant === 'sheet') {
    return (
      <div
        className="absolute inset-0 z-30 flex flex-col"
        style={{ backgroundColor: `${VIEWER_BG}f2` }}
        role="dialog"
        aria-modal="true"
        aria-label="Choisir une série"
        data-testid="dicom-series-sheet"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-white">
            <Layers className="size-4" aria-hidden="true" />
            Séries ({series.length})
          </p>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer la liste des séries"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{list}</div>
      </div>
    )
  }

  return (
    <aside
      className="hidden w-60 shrink-0 flex-col border-r border-white/10 md:flex"
      aria-label="Séries de l'étude"
      data-testid="dicom-series-rail"
    >
      <p className="inline-flex shrink-0 items-center gap-2 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-white/50">
        <Layers className="size-3.5" aria-hidden="true" />
        Séries ({series.length})
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto">{list}</div>
    </aside>
  )
}
