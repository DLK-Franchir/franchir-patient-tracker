'use client'

/**
 * Chrome commun aux moteurs (dwv / Cornerstone3D) : header, rail séries,
 * toolbar, surface (children), overlay 4 coins, slider, mention informatif,
 * sheet séries mobile. Aucun import moteur ici.
 */

import { useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import type { DicomTool, ImagingSeries, NavMode, ViewerInfoKind, ViewerStatus } from '../contract'
import { VIEWER_INFORMATIVE_NOTICE, type WlPresetId } from '../policy'
import { VIEWER_BG } from './messages'
import { DicomSeriesHeader } from './viewer-series-header'
import { DicomViewerToolbar, type WindowPreset } from './viewer-toolbar'
import { DicomViewportErrorOverlay, DicomViewportLoadingOverlay } from './viewer-overlays'
import { DicomSeriesRail } from './viewer-series-rail'
import { DicomCornerOverlay } from './viewer-corner-overlay'
import { DicomSliceSlider } from './viewer-slice-slider'

export type DicomViewerChromeProps = {
  name: string
  embedded: boolean
  fullscreen: boolean
  series?: ImagingSeries[]
  activeSeriesIndex: number
  onNextSeries?: () => void
  onPrevSeries?: () => void
  onSelectSeries?: (index: number) => void
  onClose?: () => void
  onDownloadSeries?: () => void | Promise<void>
  onDownloadStudy?: () => void | Promise<void>
  downloadBusy: boolean

  status: ViewerStatus
  infoKind: ViewerInfoKind
  navMode: NavMode
  sliceCount: number
  fileCount: number
  errorMessage: string | null
  infoNote: string | null
  poolWarning?: string | null
  preloadLoaded: number
  preloadMode: boolean
  progress: number
  viewportMessage: string

  tools: { id: DicomTool; label: string; shortLabel: string; available: boolean }[]
  tool: DicomTool
  activateTool: (tool: DicomTool) => void
  handleZoomStep: (step: number) => void
  activePreset: WlPresetId | null
  presets: readonly WindowPreset[]
  applyWindowPreset: (preset: WindowPreset) => void
  handleAutoWindow: () => void
  handleReset: () => void
  inverted: boolean
  handleToggleInvert: () => void
  handleFlipHorizontal: () => void

  canNavigateSlices: boolean
  navigateSlice: (delta: number) => void
  goToSlice: (index: number) => void
  displaySliceIndex: number
  displayTotal: number
  sliceUnit: 'coupe' | 'fichier'
  hint: string
  mobileHint: string

  modality: string | null
  description?: string | null
  windowLevel: { center: number; width: number } | null
  downloadHref?: string

  surfaceRef: RefObject<HTMLDivElement | null>
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
  onSurfacePointerEnter: () => void
  /** Conteneurs moteur (dwv layer group / élément Cornerstone). */
  children: ReactNode
}

export function DicomViewerChrome(props: DicomViewerChromeProps) {
  const {
    name,
    embedded,
    fullscreen,
    series,
    activeSeriesIndex,
    onNextSeries,
    onPrevSeries,
    onSelectSeries,
    onClose,
    onDownloadSeries,
    onDownloadStudy,
    downloadBusy,
    status,
    infoKind,
    navMode,
    sliceCount,
    fileCount,
    errorMessage,
    infoNote,
    poolWarning,
    preloadLoaded,
    preloadMode,
    progress,
    viewportMessage,
    tools,
    tool,
    activateTool,
    handleZoomStep,
    activePreset,
    presets,
    applyWindowPreset,
    handleAutoWindow,
    handleReset,
    inverted,
    handleToggleInvert,
    handleFlipHorizontal,
    canNavigateSlices,
    navigateSlice,
    goToSlice,
    displaySliceIndex,
    displayTotal,
    sliceUnit,
    hint,
    mobileHint,
    modality,
    description,
    windowLevel,
    downloadHref,
    surfaceRef,
    onKeyDown,
    onSurfacePointerEnter,
    children,
  } = props

  const [seriesSheetOpen, setSeriesSheetOpen] = useState(false)

  const isBusy = status === 'loading' || status === 'rendering'
  const isReady = status === 'ready'
  const seriesCount = series?.length ?? 0
  const hasSeriesNav = seriesCount > 1 && Boolean(onNextSeries && onPrevSeries)
  const hasSeriesRail = seriesCount > 1 && Boolean(onSelectSeries) && fullscreen
  const showHeader = Boolean(
    fullscreen || onClose || hasSeriesNav || onDownloadSeries || onDownloadStudy
  )

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col overflow-x-hidden"
      style={{ backgroundColor: embedded && !fullscreen ? 'transparent' : VIEWER_BG }}
      onKeyDown={onKeyDown}
      data-testid="dicom-viewer-root"
    >
      {showHeader ? (
        <DicomSeriesHeader
          name={name}
          seriesCount={seriesCount}
          activeSeriesIndex={activeSeriesIndex}
          isBusy={isBusy}
          infoKind={infoKind}
          sliceCount={sliceCount}
          fileCount={fileCount}
          errorMessage={errorMessage}
          infoNote={infoNote}
          preloadLoaded={preloadLoaded}
          preloadMode={preloadMode}
          onPrevSeries={hasSeriesNav ? onPrevSeries : undefined}
          onNextSeries={hasSeriesNav ? onNextSeries : undefined}
          onClose={onClose}
          onDownloadSeries={onDownloadSeries}
          onDownloadStudy={onDownloadStudy}
          downloadBusy={downloadBusy}
        />
      ) : null}

      <div className="relative flex min-h-0 flex-1">
        {hasSeriesRail && series ? (
          <DicomSeriesRail
            variant="rail"
            series={series}
            activeIndex={activeSeriesIndex}
            busy={isBusy}
            onSelect={index => onSelectSeries?.(index)}
          />
        ) : null}

        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <DicomViewerToolbar
            tools={tools}
            tool={tool}
            isReady={isReady}
            activateTool={activateTool}
            handleZoomStep={handleZoomStep}
            activePreset={activePreset}
            presets={presets}
            applyWindowPreset={applyWindowPreset}
            handleAutoWindow={handleAutoWindow}
            handleReset={handleReset}
            inverted={inverted}
            handleToggleInvert={handleToggleInvert}
            handleFlipHorizontal={handleFlipHorizontal}
            canNavigateSlices={canNavigateSlices}
            navigateSlice={delta => navigateSlice(delta)}
            displaySliceIndex={displaySliceIndex}
            displayTotal={displayTotal}
            navMode={navMode}
            showHeader={showHeader}
            infoKind={infoKind}
            sliceCount={sliceCount}
            fileCount={fileCount}
            errorMessage={errorMessage}
            infoNote={infoNote}
            preloadLoaded={preloadLoaded}
            preloadMode={preloadMode}
            hint={hint}
            mobileHint={mobileHint}
            seriesCount={hasSeriesRail ? seriesCount : 0}
            onOpenSeriesSheet={hasSeriesRail ? () => setSeriesSheetOpen(true) : undefined}
          />

          <div
            ref={surfaceRef}
            className="relative min-h-[240px] flex-1 touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/30 sm:min-h-[360px]"
            role="application"
            tabIndex={0}
            aria-label={`Visionneuse DICOM : ${name}. Molette ou flèches : changer de coupe. I : inverser.`}
            onPointerEnter={onSurfacePointerEnter}
          >
            {children}

            {isReady ? (
              <DicomCornerOverlay
                modality={modality}
                description={description}
                sliceIndex={displaySliceIndex}
                sliceTotal={displayTotal}
                windowLevel={windowLevel}
                inverted={inverted}
                unit={sliceUnit}
              />
            ) : null}

            {isBusy ? (
              <DicomViewportLoadingOverlay
                message={viewportMessage}
                progress={status === 'loading' ? progress : undefined}
              />
            ) : null}

            {status === 'error' ? (
              <DicomViewportErrorOverlay
                errorMessage={errorMessage}
                warning={poolWarning}
                downloadHref={downloadHref}
                downloadName={name}
              />
            ) : null}
          </div>

          <DicomSliceSlider
            index={displaySliceIndex}
            total={canNavigateSlices ? displayTotal : 1}
            disabled={!isReady}
            onChange={goToSlice}
            unit={sliceUnit}
          />

          <p
            className="shrink-0 px-4 py-1 text-center text-[10px] text-white/40"
            data-testid="dicom-informative-notice"
          >
            {VIEWER_INFORMATIVE_NOTICE}
          </p>

          {seriesSheetOpen && hasSeriesRail && series ? (
            <DicomSeriesRail
              variant="sheet"
              series={series}
              activeIndex={activeSeriesIndex}
              busy={isBusy}
              onSelect={index => onSelectSeries?.(index)}
              onClose={() => setSeriesSheetOpen(false)}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
