'use client'

import { useEffect, useState } from 'react'
import { CircleHelp } from 'lucide-react'
import type { DicomTool } from '../contract'
import {
  VIEWER_ACCENT,
  VIEWER_BG,
  viewerShortcutChips,
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
 * Bulle de raccourcis gestuels — distincte de `ViewerInfoBubble` (statut série).
 * Bouton « ? » pour replier / rouvrir ; état local uniquement (pas de PHI).
 */
export function ViewerShortcutBubble({
  tool,
  mode,
  hasSlices,
  className,
}: ViewerShortcutBubbleProps) {
  const [collapsed, setCollapsed] = useState(false)
  const chips = viewerShortcutChips({ tool, mode, hasSlices })

  // Ré-ouvre la bulle quand l’outil ou le mode change (aide contextuelle).
  useEffect(() => {
    setCollapsed(false)
  }, [tool, mode])

  if (collapsed) {
    return (
      <button
        type="button"
        className={`pointer-events-auto absolute bottom-3 right-3 z-20 inline-flex size-9 items-center justify-center rounded-full border border-white/25 text-white shadow-lg transition hover:border-white/50 hover:bg-white/10 ${className ?? ''}`}
        style={{ backgroundColor: VIEWER_BG }}
        aria-label="Afficher les raccourcis"
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
      className={`pointer-events-auto absolute bottom-3 left-1/2 z-20 flex max-w-[min(92%,36rem)] -translate-x-1/2 items-start gap-2 rounded-xl border border-white/20 px-3 py-2 shadow-lg ${className ?? ''}`}
      style={{ backgroundColor: VIEWER_BG, color: '#ffffff' }}
      role="status"
      aria-live="polite"
      data-testid="dicom-shortcut-bubble"
    >
      <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5" data-testid="dicom-shortcut-chips">
        {chips.map(chip => (
          <li
            key={`${chip.keys}:${chip.label}`}
            className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-1.5 py-0.5 text-[11px] leading-tight text-white"
          >
            <kbd
              className="rounded px-1 py-0.5 font-semibold tabular-nums"
              style={{ backgroundColor: `${VIEWER_ACCENT}33`, color: '#ffffff' }}
            >
              {chip.keys}
            </kbd>
            <span className="text-white/95">{chip.label}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-white/80 transition hover:bg-white/10 hover:text-white"
        aria-label="Masquer les raccourcis"
        aria-expanded={true}
        data-testid="dicom-shortcut-bubble-collapse"
        onClick={() => setCollapsed(true)}
      >
        <CircleHelp className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  )
}
