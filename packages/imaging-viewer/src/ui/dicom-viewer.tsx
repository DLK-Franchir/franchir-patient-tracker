'use client'

/**
 * Host React portable dwv — lifecycle stack/pool + chrome `/ui`.
 * Wiring auth / URLs signées / routing reste app-local (adapters minces).
 */

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { App } from 'dwv'
import type {
  DicomTool,
  DicomViewerProps,
  ImagingPoolEntry,
  NavMode,
} from '../contract'
import {
  type WlPresetId,
  WL_PRESETS,
  nextLayerGroupId,
  resolveViewerInfoKind,
} from '../policy'
import { useDicomStackMode } from '../stack'
import { useDicomSequentialPool } from '../pool'
import { useDicomSequentialNavigation } from '../sequential'
import { DicomSeriesHeader } from './viewer-series-header'
import { DicomViewerToolbar } from './viewer-toolbar'
import { DicomViewportErrorOverlay, DicomViewportLoadingOverlay } from './viewer-overlays'
import {
  VIEWER_BG,
  viewerMobileHint,
  viewerToolHint,
  viewportLoadingMessage,
} from './messages'
import { useDwvViewportResize } from './use-dwv-viewport-resize'
import { emitImagingTelemetry } from '../telemetry'

export type { DicomViewerProps }

type PoolEntry = ImagingPoolEntry<App>

export function DicomViewer({
  urls,
  name,
  embedded = false,
  fullscreen = false,
  series,
  activeSeriesIndex = 0,
  onNextSeries,
  onPrevSeries,
  onClose,
  onSliceCountResolved,
  onJpeg2000Unsupported,
  onImagingTelemetry,
}: DicomViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const poolHostRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<App | null>(null)
  const poolRef = useRef<Map<number, PoolEntry>>(new Map())
  const fileIndexRef = useRef(0)
  const toolRef = useRef<DicomTool>('WindowLevel')
  const onSliceCountResolvedRef = useRef(onSliceCountResolved)
  const onJpeg2000UnsupportedRef = useRef(onJpeg2000Unsupported)
  const onImagingTelemetryRef = useRef(onImagingTelemetry)
  const openStartedAtRef = useRef<number>(
    typeof performance !== 'undefined' ? performance.now() : Date.now(),
  )
  const paintedRef = useRef(false)
  const openReportedRef = useRef(false)
  const [layerGroupId] = useState(nextLayerGroupId)

  useEffect(() => {
    onSliceCountResolvedRef.current = onSliceCountResolved
  }, [onSliceCountResolved])

  useEffect(() => {
    onJpeg2000UnsupportedRef.current = onJpeg2000Unsupported
  }, [onJpeg2000Unsupported])

  useEffect(() => {
    onImagingTelemetryRef.current = onImagingTelemetry
  }, [onImagingTelemetry])

  const [status, setStatus] = useState<'loading' | 'rendering' | 'ready' | 'error'>('loading')
  const [progress, setProgress] = useState(0)
  const [preloadLoaded, setPreloadLoaded] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [tool, setTool] = useState<DicomTool>('WindowLevel')
  const [activePreset, setActivePreset] = useState<WlPresetId | null>(null)
  const [sliceIndex, setSliceIndex] = useState(0)
  const [sliceCount, setSliceCount] = useState(1)
  const [navMode, setNavMode] = useState<NavMode>('stack')
  const [fileIndex, setFileIndex] = useState(0)
  const [poolWarning, setPoolWarning] = useState<string | null>(null)
  const [sequentialFallbackNote, setSequentialFallbackNote] = useState<string | null>(null)

  useEffect(() => {
    fileIndexRef.current = fileIndex
  }, [fileIndex])

  const fileCount = urls.length
  const isBusy = status === 'loading' || status === 'rendering'
  const isReady = status === 'ready'

  const seriesCount = series?.length ?? 0
  const hasSeriesNav = seriesCount > 1 && onNextSeries && onPrevSeries
  const showHeader = Boolean(fullscreen || onClose || hasSeriesNav)

  const infoKind = resolveViewerInfoKind({
    isBusy,
    status,
    navMode,
    fileCount,
    sliceCount,
  })

  const urlsKey = urls.join('\n')

  const [prevUrlsKey, setPrevUrlsKey] = useState(urlsKey)
  if (prevUrlsKey !== urlsKey) {
    setPrevUrlsKey(urlsKey)
    openStartedAtRef.current =
      typeof performance !== 'undefined' ? performance.now() : Date.now()
    paintedRef.current = false
    openReportedRef.current = false
    setStatus('loading')
    setProgress(0)
    setPreloadLoaded(0)
    setSliceIndex(0)
    setSliceCount(1)
    setNavMode('stack')
    setFileIndex(0)
    setActivePreset(null)
    setErrorMessage(null)
    setPoolWarning(null)
    setSequentialFallbackNote(null)
  }

  useEffect(() => {
    const elapsed = () => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
      return Math.max(0, now - openStartedAtRef.current)
    }

    // Sequential pool marks error files as status=ready so nav continues —
    // only count a real paint when there is no viewport error banner.
    if (status === 'ready' && !errorMessage && !paintedRef.current) {
      paintedRef.current = true
      emitImagingTelemetry(onImagingTelemetryRef.current, {
        name: 'time_to_first_paint',
        durationMs: elapsed(),
        navMode,
        fileCount,
        engine: 'dwv',
        outcome: 'ready',
      })
    }

    if ((status === 'ready' || status === 'error') && !openReportedRef.current) {
      openReportedRef.current = true
      const outcome =
        status === 'error' || (status === 'ready' && Boolean(errorMessage)) ? 'error' : 'ready'
      emitImagingTelemetry(onImagingTelemetryRef.current, {
        name: 'series_open_ms',
        durationMs: elapsed(),
        navMode,
        fileCount,
        engine: 'dwv',
        outcome,
      })
    }
  }, [status, navMode, fileCount, errorMessage])

  useDicomStackMode({
    navMode,
    urlsKey,
    seriesName: name,
    layerGroupId,
    containerRef,
    appRef,
    toolRef,
    onSliceCountResolvedRef,
    onJpeg2000UnsupportedRef,
    onImagingTelemetryRef,
    setNavMode,
    setFileIndex,
    setStatus,
    setProgress,
    setPreloadLoaded,
    setErrorMessage,
    setPoolWarning,
    setSequentialFallbackNote,
    setSliceIndex,
    setSliceCount,
    setTool,
    setActivePreset,
  })

  useDicomSequentialPool({
    navMode,
    urlsKey,
    layerGroupId,
    poolHostRef,
    poolRef,
    appRef,
    fileIndexRef,
    toolRef,
    onSliceCountResolvedRef,
    onJpeg2000UnsupportedRef,
    onImagingTelemetryRef,
    setStatus,
    setProgress,
    setPreloadLoaded,
    setErrorMessage,
    setPoolWarning,
    setSliceIndex,
    setSliceCount,
  })

  useDicomSequentialNavigation({
    navMode,
    fileIndex,
    poolRef,
    appRef,
    toolRef,
    setSliceIndex,
    setStatus,
    setErrorMessage,
  })

  const activateTool = useCallback((next: DicomTool) => {
    const app = appRef.current
    if (!app) return
    app.setTool(next)
    toolRef.current = next
    setTool(next)
  }, [])

  const handleReset = useCallback(() => {
    const app = appRef.current
    if (!app) return
    app.resetZoomPan()
    app.resetViews()
    app.fitToContainer()
  }, [])

  const handleZoomStep = useCallback((step: number) => {
    const app = appRef.current
    const surface = surfaceRef.current
    if (!app || !surface) return
    const rect = surface.getBoundingClientRect()
    app.zoom(step, rect.width / 2, rect.height / 2)
    if (toolRef.current !== 'ZoomAndPan') {
      app.setTool('ZoomAndPan')
      toolRef.current = 'ZoomAndPan'
      setTool('ZoomAndPan')
    }
  }, [])

  const getViewController = useCallback(() => {
    const app = appRef.current
    if (!app) return undefined
    return app.getActiveLayerGroup()?.getActiveViewLayer()?.getViewController()
  }, [])

  const applyWindowPreset = useCallback(
    (preset: (typeof WL_PRESETS)[number]) => {
      const app = appRef.current
      const controller = getViewController()
      if (!app || !controller) return
      try {
        controller.setWindowLevelPreset(preset.id)
        app.setTool('WindowLevel')
        toolRef.current = 'WindowLevel'
        setTool('WindowLevel')
        setActivePreset(preset.id)
      } catch {
        /* preset may fail on non-grayscale modalities */
      }
    },
    [getViewController],
  )

  const navigateSlice = useCallback(
    (delta: 1 | -1) => {
      if (navMode === 'sequential' && fileCount > 1) {
        setFileIndex((prev) => Math.max(0, Math.min(fileCount - 1, prev + delta)))
        return
      }
      const controller = getViewController()
      if (!controller) return
      try {
        const helper = controller.getPositionHelper()
        if (delta > 0) helper.incrementPositionAlongScroll()
        else helper.decrementPositionAlongScroll()
      } catch {
        /* single-frame data has no scroll dimension */
      }
    },
    [navMode, fileCount, getViewController],
  )

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (status !== 'ready') return
      if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
        event.preventDefault()
        event.stopPropagation()
        navigateSlice(-1)
      } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
        event.preventDefault()
        event.stopPropagation()
        navigateSlice(1)
      }
    },
    [status, navigateSlice],
  )

  const handleSurfacePointerEnter = useCallback(() => {
    const surface = surfaceRef.current
    if (surface && !surface.contains(document.activeElement)) {
      surface.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    if (status === 'ready') {
      surfaceRef.current?.focus({ preventScroll: true })
    }
  }, [status])

  useEffect(() => {
    toolRef.current = tool
  }, [tool])

  useEffect(() => {
    const surface = surfaceRef.current
    if (!surface) return
    const blockWheelUnlessScroll = (event: WheelEvent) => {
      if (status !== 'ready' || toolRef.current !== 'Scroll') {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    surface.addEventListener('wheel', blockWheelUnlessScroll, { passive: false, capture: true })
    return () => {
      surface.removeEventListener('wheel', blockWheelUnlessScroll, { capture: true })
    }
  }, [status])

  useEffect(() => {
    if (status !== 'ready') return
    if (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches) {
      activateTool('ZoomAndPan')
    }
  }, [status, activateTool])

  useDwvViewportResize(surfaceRef, appRef, status === 'ready')

  const tools: { id: DicomTool; label: string; shortLabel: string; available: boolean }[] = [
    { id: 'WindowLevel', label: 'Fenêtrage', shortLabel: 'Fenêt.', available: true },
    { id: 'ZoomAndPan', label: 'Zoom / Déplacement', shortLabel: 'Zoom', available: true },
    {
      id: 'Scroll',
      label: 'Coupes',
      shortLabel: 'Coupes',
      available: isReady && sliceCount > 1 && navMode === 'stack',
    },
  ]

  const viewportMessage = viewportLoadingMessage({
    status,
    navMode,
    fileCount,
    fileIndex,
    preloadLoaded,
  })

  const displaySliceIndex = navMode === 'sequential' ? fileIndex : sliceIndex
  const displayTotal = navMode === 'sequential' && fileCount > 1 ? fileCount : sliceCount
  const canNavigateSlices = isReady && (sliceCount > 1 || (navMode === 'sequential' && fileCount > 1))
  const preloadMode =
    (navMode === 'sequential' && fileCount > 1) ||
    (navMode === 'stack' && fileCount > 1 && preloadLoaded > 0)

  const hint = viewerToolHint({ navMode, fileCount, tool, sliceCount })
  const mobileHint = viewerMobileHint({ tool, sliceCount })

  const infoNote = navMode === 'sequential' ? sequentialFallbackNote ?? poolWarning : null

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col overflow-x-hidden"
      style={{ backgroundColor: embedded && !fullscreen ? 'transparent' : VIEWER_BG }}
      onKeyDown={handleKeyDown}
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
        />
      ) : null}

      <DicomViewerToolbar
        tools={tools}
        tool={tool}
        isReady={isReady}
        activateTool={activateTool}
        handleZoomStep={handleZoomStep}
        activePreset={activePreset}
        applyWindowPreset={applyWindowPreset}
        handleReset={handleReset}
        canNavigateSlices={canNavigateSlices}
        navigateSlice={navigateSlice}
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
      />

      <div
        ref={surfaceRef}
        className="relative min-h-[240px] flex-1 touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/30 sm:min-h-[360px]"
        role="application"
        tabIndex={0}
        aria-label={`Visionneuse DICOM : ${name}. Flèches gauche/droite : changer de coupe.`}
        onPointerEnter={handleSurfacePointerEnter}
      >
        <div
          ref={containerRef}
          id={layerGroupId}
          className="absolute inset-0"
          style={{ display: navMode === 'sequential' ? 'none' : 'block' }}
        />
        <div
          ref={poolHostRef}
          className="absolute inset-0"
          style={{ display: navMode === 'sequential' ? 'block' : 'none' }}
          data-testid="dicom-pool-host"
        />

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
            downloadHref={urls[0]}
            downloadName={name}
          />
        ) : null}
      </div>
    </div>
  )
}
