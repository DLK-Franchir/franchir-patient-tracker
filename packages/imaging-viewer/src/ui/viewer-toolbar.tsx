'use client'

import { ArrowLeft, ArrowRight, Contrast, FlipHorizontal2, Layers } from 'lucide-react'
import type { DicomTool, NavMode, ViewerInfoKind } from '../contract'
import { WL_PRESETS, type WlPresetId } from '../policy'
import { VIEWER_ACCENT } from './messages'
import { ViewerInfoBubble } from './viewer-info-bubble'

export type WindowPreset = (typeof WL_PRESETS)[number]

export type DicomViewerToolbarProps = {
  tools: { id: DicomTool; label: string; shortLabel: string; available: boolean }[]
  tool: DicomTool
  isReady: boolean
  activateTool: (tool: DicomTool) => void
  handleZoomStep: (step: number) => void
  activePreset: WlPresetId | null
  /** Presets HU filtrés par modality (vide hors CT) — voir `windowPresetsForModality`. */
  presets?: readonly WindowPreset[]
  applyWindowPreset: (preset: WindowPreset) => void
  /** Retour au fenêtrage DICOM initial (« Auto »). */
  handleAutoWindow?: () => void
  handleReset: () => void
  inverted?: boolean
  handleToggleInvert?: () => void
  handleFlipHorizontal?: () => void
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
  /** Mobile : ouvre le panneau séries (rail desktop masqué). */
  seriesCount?: number
  onOpenSeriesSheet?: () => void
}

const TOOL_BTN =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-3 py-2 text-xs font-medium transition disabled:opacity-30'

export function DicomViewerToolbar({
  tools,
  tool,
  isReady,
  activateTool,
  handleZoomStep,
  activePreset,
  presets = WL_PRESETS,
  applyWindowPreset,
  handleAutoWindow,
  handleReset,
  inverted = false,
  handleToggleInvert,
  handleFlipHorizontal,
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
  seriesCount = 0,
  onOpenSeriesSheet,
}: DicomViewerToolbarProps) {
  return (
    <>
      <div
        className="flex max-w-full flex-wrap items-center gap-2 overflow-x-auto border-b px-3 py-2"
        style={{ borderColor: 'rgba(255,255,255,0.1)' }}
        data-testid="dicom-viewer-toolbar"
      >
        {onOpenSeriesSheet && seriesCount > 1 ? (
          <button
            type="button"
            onClick={onOpenSeriesSheet}
            aria-label={`Choisir une série (${seriesCount})`}
            className={`${TOOL_BTN} gap-1 bg-white/10 text-white md:hidden`}
            data-testid="dicom-series-sheet-open"
          >
            <Layers className="size-4" aria-hidden="true" />
            Séries
          </button>
        ) : null}

        {tools
          .filter(t => t.available)
          .map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => activateTool(t.id)}
              disabled={!isReady}
              aria-pressed={tool === t.id}
              aria-label={t.label}
              className={TOOL_BTN}
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
          {handleAutoWindow ? (
            <button
              type="button"
              onClick={handleAutoWindow}
              disabled={!isReady}
              aria-pressed={activePreset === null}
              aria-label="Fenêtrage automatique (valeurs DICOM)"
              title="Fenêtrage automatique (valeurs DICOM)"
              className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition disabled:opacity-30"
              style={{
                backgroundColor:
                  activePreset === null ? 'rgba(56,178,172,0.35)' : 'rgba(255,255,255,0.06)',
                color: '#FFFFFF',
              }}
              data-testid="dicom-wl-auto"
            >
              Auto
            </button>
          ) : null}
          {presets.map(preset => (
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
                  activePreset === preset.id ? 'rgba(56,178,172,0.35)' : 'rgba(255,255,255,0.06)',
                color: '#FFFFFF',
              }}
              data-testid={`dicom-wl-preset-${preset.id}`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {handleToggleInvert ? (
          <button
            type="button"
            onClick={handleToggleInvert}
            disabled={!isReady}
            aria-pressed={inverted}
            aria-label="Inverser les niveaux de gris (I)"
            title="Inverser (I)"
            className={`${TOOL_BTN} gap-1 text-white/85 hover:bg-white/10`}
            style={{ backgroundColor: inverted ? 'rgba(56,178,172,0.35)' : undefined }}
            data-testid="dicom-invert"
          >
            <Contrast className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Inverser</span>
          </button>
        ) : null}

        {handleFlipHorizontal ? (
          <button
            type="button"
            onClick={handleFlipHorizontal}
            disabled={!isReady}
            aria-label="Miroir horizontal (H)"
            title="Miroir horizontal (H)"
            className="hidden min-h-11 min-w-11 items-center justify-center rounded-lg px-3 py-2 text-xs font-medium text-white/85 transition hover:bg-white/10 disabled:opacity-30 sm:inline-flex"
            data-testid="dicom-flip-h"
          >
            <FlipHorizontal2 className="size-4" aria-hidden="true" />
          </button>
        ) : null}

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
              aria-label={navMode === 'sequential' ? 'Fichier précédent' : 'Coupe précédente'}
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
