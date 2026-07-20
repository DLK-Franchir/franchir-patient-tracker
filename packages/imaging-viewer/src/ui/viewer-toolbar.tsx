'use client'

import { ArrowLeft, ArrowRight } from 'lucide-react'
import type { DicomTool, NavMode, ViewerInfoKind } from '../contract'
import { WL_PRESETS, type WlPresetId } from '../policy'
import { VIEWER_ACCENT } from './messages'
import { ViewerInfoBubble } from './viewer-info-bubble'

export type DicomViewerToolbarProps = {
  tools: { id: DicomTool; label: string; shortLabel: string; available: boolean }[]
  tool: DicomTool
  isReady: boolean
  activateTool: (tool: DicomTool) => void
  handleZoomStep: (step: number) => void
  activePreset: WlPresetId | null
  applyWindowPreset: (preset: (typeof WL_PRESETS)[number]) => void
  handleReset: () => void
  canNavigateSlices: boolean
  navigateSlice: (delta: 1 | -1) => void
  displaySliceIndex: number
  displayTotal: number
  navMode: NavMode
  showHeader: boolean
  infoKind: ViewerInfoKind
  sliceCount: number
  fileCount: number
  errorMessage: string | null
  infoNote?: string | null
  preloadLoaded: number
  preloadMode: boolean
  hint: string
  mobileHint: string
}

export function DicomViewerToolbar({
  tools,
  tool,
  isReady,
  activateTool,
  handleZoomStep,
  activePreset,
  applyWindowPreset,
  handleReset,
  canNavigateSlices,
  navigateSlice,
  displaySliceIndex,
  displayTotal,
  navMode,
  showHeader,
  infoKind,
  sliceCount,
  fileCount,
  errorMessage,
  infoNote,
  preloadLoaded,
  preloadMode,
  hint,
  mobileHint,
}: DicomViewerToolbarProps) {
  return (
    <>
      <div
        className="flex max-w-full flex-wrap items-center gap-2 overflow-x-auto border-b px-3 py-2"
        style={{ borderColor: 'rgba(255,255,255,0.1)' }}
        data-testid="dicom-viewer-toolbar"
      >
        {tools
          .filter((t) => t.available)
          .map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => activateTool(t.id)}
              disabled={!isReady}
              aria-pressed={tool === t.id}
              aria-label={t.label}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-3 py-2 text-xs font-medium transition disabled:opacity-30"
              style={{
                backgroundColor: tool === t.id ? VIEWER_ACCENT : 'rgba(255,255,255,0.08)',
                color: '#FFFFFF',
              }}
            >
              <span className="sm:hidden">{t.shortLabel}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}

        <div className="flex items-center gap-1 sm:hidden">
          <button
            type="button"
            onClick={() => handleZoomStep(0.15)}
            disabled={!isReady}
            aria-label="Zoom avant"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-white/10 text-lg font-bold text-white transition disabled:opacity-30"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => handleZoomStep(-0.15)}
            disabled={!isReady}
            aria-label="Zoom arrière"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-white/10 text-lg font-bold text-white transition disabled:opacity-30"
          >
            −
          </button>
        </div>

        <span className="mx-1 hidden h-4 w-px bg-white/15 sm:block" aria-hidden="true" />

        <div className="hidden max-w-full flex-wrap items-center gap-2 sm:flex">
          {WL_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyWindowPreset(preset)}
              disabled={!isReady}
              aria-pressed={activePreset === preset.id}
              aria-label={`Preset fenêtrage ${preset.label}`}
              className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition disabled:opacity-30"
              style={{
                backgroundColor:
                  activePreset === preset.id
                    ? 'rgba(56,178,172,0.35)'
                    : 'rgba(255,255,255,0.06)',
                color: '#FFFFFF',
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleReset}
          disabled={!isReady}
          aria-label="Réinitialiser"
          className="inline-flex min-h-11 items-center justify-center rounded-lg px-3 py-2 text-xs font-medium text-white/80 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
        >
          <span className="sm:hidden">Réinit.</span>
          <span className="hidden sm:inline">Réinitialiser</span>
        </button>

        {canNavigateSlices ? (
          <div className="ml-auto flex items-center gap-1 sm:ml-2">
            <button
              type="button"
              onClick={() => navigateSlice(-1)}
              disabled={displaySliceIndex <= 0}
              aria-label={
                navMode === 'sequential' ? 'Fichier précédent' : 'Coupe précédente'
              }
              className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium text-white/80 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Préc.
            </button>
            <span
              className="px-1 text-xs tabular-nums text-white/60"
              aria-live="polite"
              data-testid="dicom-slice-indicator"
            >
              {displaySliceIndex + 1} / {displayTotal}
            </span>
            <button
              type="button"
              onClick={() => navigateSlice(1)}
              disabled={displaySliceIndex >= displayTotal - 1}
              aria-label={navMode === 'sequential' ? 'Fichier suivant' : 'Coupe suivante'}
              className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium text-white/80 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
            >
              Suiv.
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : null}

        {!showHeader ? (
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
        ) : null}

        <span className="ml-auto hidden text-[11px] text-white/40 sm:block">{hint}</span>
      </div>

      <p className="shrink-0 border-b border-white/5 px-3 py-1.5 text-center text-[11px] text-white/50 sm:hidden">
        {mobileHint}
      </p>
    </>
  )
}
