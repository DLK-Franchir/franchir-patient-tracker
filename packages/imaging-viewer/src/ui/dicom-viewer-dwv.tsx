'use client'

/**
 * Host dwv — lifecycle stack / pool séquentiel / repli OpenJPEG, chrome partagé
 * `DicomViewerChrome`. Sélectionné par `DicomViewer` quand `engine === 'dwv'`.
 */

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { App } from 'dwv'
import type { DicomTool, DicomViewerProps, ImagingPoolEntry, NavMode } from '../contract'
import {
  type WlPresetId,
  WL_PRESETS,
  accumulateWheelSlices,
  nextLayerGroupId,
  normalizeModality,
  resolveViewerCapabilities,
  resolveViewerInfoKind,
  windowPresetsForModality,
} from '../policy'
import {
  flipViewLayer,
  readModality,
  readWindowLevel,
  resetWindowLevel,
  setSliceIndex as setDwvSliceIndex,
  toggleInvert,
} from '../dwv-app'
import { useDicomStackMode } from '../stack'
import { useDicomSequentialPool } from '../pool'
import { useDicomSequentialNavigation } from '../sequential'
import { DicomViewerChrome } from './viewer-chrome'
import { viewerMobileHint, viewerToolHint, viewportLoadingMessage } from './messages'
import { useDwvViewportResize } from './use-dwv-viewport-resize'
import { emitImagingTelemetry, nowMs } from '../telemetry'

type PoolEntry = ImagingPoolEntry<App>
type WindowLevelState = { center: number; width: number } | null

export function DicomViewerDwv({
  urls,
  name,
  embedded = false,
  fullscreen = false,
  series,
  activeSeriesIndex = 0,
  onNextSeries,
  onPrevSeries,
  onSelectSeries,
  modality: modalityProp,
  onClose,
  onSliceCountResolved,
  capabilities: capabilitiesOverride,
  onJpeg2000Unsupported,
  onImagingTelemetry,
  onDownloadSeries,
  onDownloadStudy,
  downloadBusy = false,
}: DicomViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const poolHostRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<App | null>(null)
  const poolRef = useRef<Map<number, PoolEntry>>(new Map())
  const fileIndexRef = useRef(0)
  const onSliceCountResolvedRef = useRef(onSliceCountResolved)
  const onJpeg2000UnsupportedRef = useRef(onJpeg2000Unsupported)
  const onImagingTelemetryRef = useRef(onImagingTelemetry)
  const openStartedAtRef = useRef(0)
  const paintedRef = useRef(false)
  const openReportedRef = useRef(false)
  const wheelAccumRef = useRef(0)
  const flippedXRef = useRef(false)
  const [layerGroupId] = useState(nextLayerGroupId)
  const capabilities = resolveViewerCapabilities(capabilitiesOverride)

  useEffect(() => {
    onSliceCountResolvedRef.current = onSliceCountResolved
  }, [onSliceCountResolved])

  useEffect(() => {
    onJpeg2000UnsupportedRef.current = capabilities.jpeg2000OpenJpegFallback
      ? onJpeg2000Unsupported
      : undefined
  }, [onJpeg2000Unsupported, capabilities.jpeg2000OpenJpegFallback])

  useEffect(() => {
    onImagingTelemetryRef.current = onImagingTelemetry
  }, [onImagingTelemetry])

  const [status, setStatus] = useState<'loading' | 'rendering' | 'ready' | 'error'>('loading')
  const [progress, setProgress] = useState(0)
  const [preloadLoaded, setPreloadLoaded] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [activePreset, setActivePreset] = useState<WlPresetId | null>(null)
  const [sliceIndex, setSliceIndex] = useState(0)
  const [sliceCount, setSliceCount] = useState(1)
  const [navMode, setNavMode] = useState<NavMode>('stack')
  const [fileIndex, setFileIndex] = useState(0)
  const [poolWarning, setPoolWarning] = useState<string | null>(null)
  const [sequentialFallbackNote, setSequentialFallbackNote] = useState<string | null>(null)
  const [windowLevel, setWindowLevel] = useState<WindowLevelState>(null)
  const [inverted, setInverted] = useState(false)
  const [dwvModality, setDwvModality] = useState<string | null>(null)
  const [isCoarsePointer, setIsCoarsePointer] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches
  )

  useEffect(() => {
    fileIndexRef.current = fileIndex
  }, [fileIndex])

  // Tactile : glisser = déplacer par défaut (le fenêtrage reste accessible).
  const initialTool: DicomTool = isCoarsePointer ? 'ZoomAndPan' : 'WindowLevel'
  const toolRef = useRef<DicomTool>(initialTool)
  const [tool, setTool] = useState<DicomTool>(initialTool)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const media = window.matchMedia('(pointer: coarse)')
    const onChange = (event: MediaQueryListEvent) => setIsCoarsePointer(event.matches)
    media.addEventListener?.('change', onChange)
    return () => media.removeEventListener?.('change', onChange)
  }, [])

  const fileCount = urls.length
  const isBusy = status === 'loading' || status === 'rendering'
  const isReady = status === 'ready'

  const activeSeries = series?.[activeSeriesIndex]
  const modality = dwvModality ?? normalizeModality(modalityProp ?? activeSeries?.modality)
  const presets = windowPresetsForModality(modality)

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
    setWindowLevel(null)
    setInverted(false)
    setDwvModality(null)
  }

  useEffect(() => {
    openStartedAtRef.current = nowMs()
    paintedRef.current = false
    openReportedRef.current = false
    wheelAccumRef.current = 0
    flippedXRef.current = false
  }, [urlsKey])

  useEffect(() => {
    const elapsed = () => Math.max(0, nowMs() - openStartedAtRef.current)

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

  // Overlay W/L + modality : suit la vue active (change en mode séquentiel).
  useEffect(() => {
    if (status !== 'ready') return
    const app = appRef.current
    if (!app) return
    const sync = () => {
      setWindowLevel(readWindowLevel(app))
    }
    sync()
    const detected = readModality(app)
    if (detected) setDwvModality(detected)
    app.addEventListener('wlchange', sync)
    return () => {
      app.removeEventListener('wlchange', sync)
    }
  }, [status, navMode, fileIndex])

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
    // Un miroir actif + resetZoomPan laisse dwv sur un canvas noir : on
    // annule d'abord le miroir (flip idempotent), puis on réinitialise.
    if (flippedXRef.current) {
      flipViewLayer(app, 'x')
      flippedXRef.current = false
    }
    app.resetZoomPan()
    app.resetViews()
    app.fitToContainer()
    setActivePreset(null)
    setWindowLevel(readWindowLevel(app))
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
    [getViewController]
  )

  const handleAutoWindow = useCallback(() => {
    const app = appRef.current
    if (!app) return
    resetWindowLevel(app)
    setActivePreset(null)
    setWindowLevel(readWindowLevel(app))
  }, [])

  const handleToggleInvert = useCallback(() => {
    const app = appRef.current
    if (!app) return
    const next = toggleInvert(app)
    if (next !== null) setInverted(next)
  }, [])

  const handleFlipHorizontal = useCallback(() => {
    const app = appRef.current
    if (!app) return
    flipViewLayer(app, 'x')
    flippedXRef.current = !flippedXRef.current
  }, [])

  const goToSlice = useCallback(
    (target: number) => {
      if (navMode === 'sequential' && fileCount > 1) {
        setFileIndex(Math.max(0, Math.min(fileCount - 1, target)))
        return
      }
      const app = appRef.current
      if (!app) return
      if (setDwvSliceIndex(app, target)) {
        setSliceIndex(Math.max(0, Math.min(sliceCount - 1, target)))
      }
    },
    [navMode, fileCount, sliceCount]
  )

  const navigateSlice = useCallback(
    (delta: number) => {
      if (delta === 0) return
      if (navMode === 'sequential' && fileCount > 1) {
        setFileIndex(prev => Math.max(0, Math.min(fileCount - 1, prev + delta)))
        return
      }
      const controller = getViewController()
      if (!controller) return
      if (Math.abs(delta) !== 1) {
        const app = appRef.current
        if (app) {
          setDwvSliceIndex(app, controller.getCurrentIndexScrollValue() + delta)
        }
        return
      }
      try {
        const helper = controller.getPositionHelper()
        if (delta > 0) helper.incrementPositionAlongScroll()
        else helper.decrementPositionAlongScroll()
      } catch {
        /* single-frame data has no scroll dimension */
      }
    },
    [navMode, fileCount, getViewController]
  )

  const displaySliceIndex = navMode === 'sequential' ? fileIndex : sliceIndex
  const displayTotal = navMode === 'sequential' && fileCount > 1 ? fileCount : sliceCount
  const canNavigateSlices =
    isReady && (sliceCount > 1 || (navMode === 'sequential' && fileCount > 1))

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (status !== 'ready') return
      const key = event.key
      const consume = () => {
        event.preventDefault()
        event.stopPropagation()
      }
      if (key === 'ArrowLeft' || key === 'ArrowDown') {
        consume()
        navigateSlice(-1)
      } else if (key === 'ArrowRight' || key === 'ArrowUp') {
        consume()
        navigateSlice(1)
      } else if (key === 'PageDown') {
        consume()
        navigateSlice(Math.max(1, Math.round(displayTotal / 10)))
      } else if (key === 'PageUp') {
        consume()
        navigateSlice(-Math.max(1, Math.round(displayTotal / 10)))
      } else if (key === 'Home') {
        consume()
        goToSlice(0)
      } else if (key === 'End') {
        consume()
        goToSlice(displayTotal - 1)
      } else if (key === 'i' || key === 'I') {
        consume()
        handleToggleInvert()
      } else if (key === 'h' || key === 'H') {
        consume()
        handleFlipHorizontal()
      } else if (key === 'r' || key === 'R') {
        consume()
        handleReset()
      }
    },
    [
      status,
      navigateSlice,
      goToSlice,
      displayTotal,
      handleToggleInvert,
      handleFlipHorizontal,
      handleReset,
    ]
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

  // Molette = coupes, quel que soit l'outil actif (Horos / RadiAnt / OsiriX).
  // Capture avant dwv pour un comportement identique en stack et séquentiel ;
  // le scroll de page est toujours bloqué au-dessus du viewport.
  useEffect(() => {
    const surface = surfaceRef.current
    if (!surface) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      event.stopPropagation()
      if (!canNavigateSlices) return
      const { steps, remainder } = accumulateWheelSlices(
        wheelAccumRef.current,
        event.deltaY,
        event.deltaMode
      )
      wheelAccumRef.current = remainder
      if (steps !== 0) navigateSlice(steps)
    }
    surface.addEventListener('wheel', onWheel, { passive: false, capture: true })
    return () => {
      surface.removeEventListener('wheel', onWheel, { capture: true })
    }
  }, [canNavigateSlices, navigateSlice])

  useDwvViewportResize(surfaceRef, appRef, status === 'ready')

  const tools: { id: DicomTool; label: string; shortLabel: string; available: boolean }[] = [
    { id: 'WindowLevel', label: 'Fenêtrage', shortLabel: 'Fenêt.', available: true },
    { id: 'ZoomAndPan', label: 'Zoom / Déplacement', shortLabel: 'Zoom', available: true },
    {
      // Tactile uniquement : au pointeur, la molette fait déjà défiler les coupes.
      id: 'Scroll',
      label: 'Coupes',
      shortLabel: 'Coupes',
      available: isCoarsePointer && isReady && sliceCount > 1 && navMode === 'stack',
    },
  ]

  const viewportMessage = viewportLoadingMessage({
    status,
    navMode,
    fileCount,
    fileIndex,
    preloadLoaded,
  })

  const preloadMode =
    (navMode === 'sequential' && fileCount > 1) ||
    (navMode === 'stack' && fileCount > 1 && preloadLoaded > 0)

  const hint = viewerToolHint({ navMode, fileCount, tool, sliceCount })
  const mobileHint = viewerMobileHint({ tool, sliceCount })

  const infoNote = navMode === 'sequential' ? (sequentialFallbackNote ?? poolWarning) : null
  const sliceUnit = navMode === 'sequential' && fileCount > 1 ? 'fichier' : 'coupe'

  return (
    <DicomViewerChrome
      name={name}
      embedded={embedded}
      fullscreen={fullscreen}
      series={series}
      activeSeriesIndex={activeSeriesIndex}
      onNextSeries={onNextSeries}
      onPrevSeries={onPrevSeries}
      onSelectSeries={onSelectSeries}
      onClose={onClose}
      onDownloadSeries={onDownloadSeries}
      onDownloadStudy={onDownloadStudy}
      downloadBusy={downloadBusy}
      status={status}
      infoKind={infoKind}
      navMode={navMode}
      sliceCount={sliceCount}
      fileCount={fileCount}
      errorMessage={errorMessage}
      infoNote={infoNote}
      poolWarning={poolWarning}
      preloadLoaded={preloadLoaded}
      preloadMode={preloadMode}
      progress={progress}
      viewportMessage={viewportMessage}
      tools={tools}
      tool={tool}
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
      navigateSlice={navigateSlice}
      goToSlice={goToSlice}
      displaySliceIndex={displaySliceIndex}
      displayTotal={displayTotal}
      sliceUnit={sliceUnit}
      hint={hint}
      mobileHint={mobileHint}
      modality={modality}
      description={activeSeries?.description}
      windowLevel={windowLevel}
      downloadHref={urls[0]}
      surfaceRef={surfaceRef}
      onKeyDown={handleKeyDown}
      onSurfacePointerEnter={handleSurfacePointerEnter}
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
    </DicomViewerChrome>
  )
}
