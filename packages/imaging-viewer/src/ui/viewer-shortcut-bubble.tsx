'use client'

import { useEffect, useState } from 'react'
import { CircleHelp, X } from 'lucide-react'
import type { DicomTool } from '../contract'
import {
  VIEWER_ACCENT,
  VIEWER_BG,
  viewerShortcutHelp,
  type ViewerShortcutMode,
} from './messages'

export type ViewerShortcutBubbleProps = {
  tool: DicomTool
  mode: ViewerShortcutMode
  hasSlices: boolean
  /** Affiché uniquement desktop ; mobile garde la ligne hint. */
  className?: string
}

/**
 * Bulle d’aide gestuelle — distincte de `ViewerInfoBubble` (statut série).
 * Titre + phrase d’intro + puces explicites. « ? » pour replier.
 */
export function ViewerShortcutBubble({
  tool,
  mode,
  hasSlices,
  className,
}: ViewerShortcutBubbleProps) {
  const [collapsed, setCollapsed] = useState(false)
  const help = viewerShortcutHelp({ tool, mode, hasSlices })

  useEffect(() => {
    setCollapsed(false)
  }, [tool, mode])

  if (collapsed) {
    return (
      <button
        type="button"
        className={`pointer-events-auto absolute bottom-3 right-3 z-20 inline-flex size-9 items-center justify-center rounded-full border border-white/25 text-white shadow-lg transition hover:border-white/50 hover:bg-white/10 ${className ?? ''}`}
        style={{ backgroundColor: VIEWER_BG }}
        aria-label="Afficher l’aide des raccourcis"
        aria-expanded={false}
        data-testid="dicom-shortcut-bubble-expand"
        onClick={() => setCollapsed(false)}
      >
        <CircleHelp className="size-4" strokeWidth={1.75} aria-hidden="true" />
      </button>
    )
  }

  return (
    <div
      className={`pointer-events-auto absolute bottom-3 left-1/2 z-20 flex w-[min(92%,28rem)] -translate-x-1/2 flex-col gap-2 rounded-xl border border-white/20 px-3 py-2.5 shadow-lg ${className ?? ''}`}
      style={{ backgroundColor: VIEWER_BG, color: '#ffffff' }}
      role="status"
      aria-live="polite"
      data-testid="dicom-shortcut-bubble"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className="text-xs font-semibold tracking-wide"
            style={{ color: VIEWER_ACCENT }}
            data-testid="dicom-shortcut-title"
          >
            {help.title}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-white/85" data-testid="dicom-shortcut-summary">
            {help.summary}
          </p>
        </div>
        <button
          type="button"
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-white/80 transition hover:bg-white/10 hover:text-white"
          aria-label="Masquer l’aide"
          aria-expanded={true}
          data-testid="dicom-shortcut-bubble-collapse"
          onClick={() => setCollapsed(true)}
        >
          <X className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
      <ul className="flex min-w-0 flex-col gap-1.5" data-testid="dicom-shortcut-chips">
        {help.chips.map(chip => (
          <li
            key={`${chip.keys}:${chip.label}`}
            className="flex items-start gap-2 text-[11px] leading-snug text-white"
          >
            <kbd
              className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 font-semibold tabular-nums"
              style={{ backgroundColor: `${VIEWER_ACCENT}40`, color: '#ffffff' }}
            >
              {chip.keys}
            </kbd>
            <span className="text-white/95">{chip.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
