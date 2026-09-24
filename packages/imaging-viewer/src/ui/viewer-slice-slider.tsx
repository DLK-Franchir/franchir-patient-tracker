'use client'

import { VIEWER_ACCENT } from './messages'

export type DicomSliceSliderProps = {
  index: number
  total: number
  disabled?: boolean
  onChange: (index: number) => void
  unit?: 'coupe' | 'fichier'
}

/** Slider de coupes (U0) sous le viewport — complète molette / flèches / Préc.-Suiv. */
export function DicomSliceSlider({
  index,
  total,
  disabled = false,
  onChange,
  unit = 'coupe',
}: DicomSliceSliderProps) {
  if (total <= 1) return null
  const label = unit === 'fichier' ? 'Fichier' : 'Coupe'
  return (
    <div
      className="flex shrink-0 items-center gap-3 border-t border-white/10 px-4 py-2"
      data-testid="dicom-slice-slider"
    >
      <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-white/60">1</span>
      <input
        type="range"
        min={0}
        max={total - 1}
        step={1}
        value={Math.max(0, Math.min(total - 1, index))}
        disabled={disabled}
        onChange={event => onChange(Number(event.currentTarget.value))}
        aria-label={`${label} ${index + 1} sur ${total}`}
        aria-valuetext={`${label} ${index + 1} sur ${total}`}
        className="h-2 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
        style={{ accentColor: VIEWER_ACCENT }}
        data-testid="dicom-slice-slider-input"
      />
      <span className="w-10 shrink-0 text-[11px] tabular-nums text-white/60">{total}</span>
    </div>
  )
}
