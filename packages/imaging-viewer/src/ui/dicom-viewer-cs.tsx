'use client'

/**
 * Host Cornerstone3D (U1) — même contrat `DicomViewerProps`, même chrome que
 * le host dwv. Un StackViewport `wadouri:` sur URLs signées ; les orientations
 * hétérogènes sont acceptées (pas de pool séquentiel, pas de repli OpenJPEG).
 */

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { DicomTool, DicomViewerProps } from '../contract'
import {
  type WlPresetId,
  WL_PRESETS,
  accumulateWheelSlices,
  normalizeModality,
  resolveViewerCapabilities,
  resolveViewerInfoKind,
  windowPresetsForModality,
} from '../policy'
import {
  applyCsTool,
  csFlip,
  csGoToSlice,
  csNavigateSlice,
  csResetView,
  csResetWindowLevel,
  csSetWindowLevel,
  csToggleInvert,
  csZoomStep,
  useCornerstoneStack,
  type CsStackHandle,
} from '../engine-cs'
import { DicomViewerChrome } from './viewer-chrome'
import { viewerMobileHint, viewerToolHint, viewportLoadingMessage } from './messages'
import { emitImagingTelemetry, nowMs } from '../telemetry'

type WindowLevelState = { center: number; width: number } | null

export function DicomViewerCornerstone({
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
  onImagingTelemetry,
  onDownloadSeries,
  onDownloadStudy,
  downloadBusy = false,
}: DicomViewerProps) {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const elementRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<CsStackHandle | null>(null)
  const onSliceCountResolvedRef = useRef(onSliceCountResolved)
  const onImagingTelemetryRef = useRef(onImagingTelemetry)
  const openStartedAtRef = useRef(0)
  const paintedRef = useRef(false)
  const openReportedRef = useRef(false)
  const wheelAccumRef = useRef(0)

  // Identité stable : l'effet stack dépend des capabilities (wasm path, concurrence).
  const capabilitiesKey = JSON.stringify(capabilitiesOverride ?? null)
  const capabilities = useMemo(
    () => resolveViewerCapabilities(capabilitiesOverride),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [capabilitiesKey]
  )

  useEffect(() => {
    onSliceCountResolvedRef.current = onSliceCountResolved
  }, [onSliceCountResolved])
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
  const [windowLevel, setWindowLevel] = useState<WindowLevelState>(null)
  const [inverted, setInverted] = useState(false)
  const [csModality, setCsModality] = useState<string | null>(null)
  const [failedIndexes, setFailedIndexes] = useState<Set<number>>(new Set())
  const [isCoarsePointer, setIsCoarsePointer] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches
  )

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
  const modality = csModality ?? normalizeModality(modalityProp ?? activeSeries?.modality)
  const presets = windowPresetsForModality(modality)
  const urlsKey = urls.join('\n')

  const [prevUrlsKey, setPrevUrlsKey] = useState(urlsKey)
  if (prevUrlsKey !== urlsKey) {
    setPrevUrlsKey(urlsKey)
    setStatus('loading')
    setProgress(0)
    setPreloadLoaded(0)
    setSliceIndex(0)
    setSliceCount(1)
    setActivePreset(null)
    setErrorMessage(null)
    setWindowLevel(null)
    setInverted(false)
    setCsModality(null)
    setFailedIndexes(new Set())
  }

  useEffect(() => {
    openStartedAtRef.current = nowMs()
    paintedRef.current = false
    openReportedRef.current = false
    wheelAccumRef.current = 0
  }, [urlsKey])

  useEffect(() => {
    const elapsed = () => Math.max(0, nowMs() - openStartedAtRef.current)
    if (status === 'ready' && !errorMessage && !paintedRef.current) {
      paintedRef.current = true
      emitImagingTelemetry(onImagingTelemetryRef.current, {
        name: 'time_to_first_paint',
        durationMs: elapsed(),
        navMode: 'stack',
        fileCount,
        engine: 'cornerstone',
        outcome: 'ready',
      })
    }
    if ((status === 'ready' || status === 'error') && !openReportedRef.current) {
      openReportedRef.current = true
      emitImagingTelemetry(onImagingTelemetryRef.current, {
        name: 'series_open_ms',
        durationMs: elapsed(),
        navMode: 'stack',
        fileCount,
        engine: 'cornerstone',
        outcome: status === 'error' || Boolean(errorMessage) ? 'error' : 'ready',
      })
    }
  }, [status, fileCount, errorMessage])

  useCornerstoneStack({
    urlsKey,
    elementRef,
    handleRef,
    capabilities,
    toolRef,
    onImagingTelemetryRef,
    setStatus,
    setProgress,
    setPreloadLoaded,
    setErrorMessage,
    setSliceIndex,
    setSliceCount,
    setWindowLevel,
    setModality: setCsModality,
    setFailedIndexes,
    onSliceCountResolvedRef,
  })

  const activateTool = useCallback((next: DicomTool) => {
    toolRef.current = next
    setTool(next)
    const handle = handleRef.current
    if (handle) applyCsTool(handle.toolGroupId, next)
  }, [])

  const handleReset = useCallback(() => {
    csResetView(handleRef.current)
    setActivePreset(null)
    setInverted(false)
  }, [])

  const handleZoomStep = useCallback(
    (step: number) => {
      csZoomStep(handleRef.current, step)
      if (toolRef.current !== 'ZoomAndPan') activateTool('ZoomAndPan')
    },
    [activateTool]
  )

  const applyWindowPreset = useCallback(
    (preset: (typeof WL_PRESETS)[number]) => {
      csSetWindowLevel(handleRef.current, preset.center, preset.width)
      if (toolRef.current !== 'WindowLevel') activateTool('WindowLevel')
      setActivePreset(preset.id)
    },
    [activateTool]
  )

  const handleAutoWindow = useCallback(() => {
    csResetWindowLevel(handleRef.current)
    setActivePreset(null)
  }, [])

  const handleToggleInvert = useCallback(() => {
    const next = csToggleInvert(handleRef.current)
    if (next !== null) setInverted(next)
  }, [])

  const handleFlipHorizontal = useCallback(() => {
    csFlip(handleRef.current, 'x')
  }, [])

  const goToSlice = useCallback(
    (target: number) => {
      void csGoToSlice(handleRef.current, target, failedIndexes)
    },
    [failedIndexes]
  )

  const navigateSlice = useCallback(
    (delta: number) => {
      if (delta === 0) return
      void csNavigateSlice(handleRef.current, delta, failedIndexes)
    },
    [failedIndexes]
  )

  const canNavigateSlices = isReady && sliceCount > 1

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
        navigateSlice(Math.max(1, Math.round(sliceCount / 10)))
      } else if (key === 'PageUp') {
        consume()
        navigateSlice(-Math.max(1, Math.round(sliceCount / 10)))
      } else if (key === 'Home') {
        consume()
        goToSlice(0)
      } else if (key === 'End') {
        consume()
        goToSlice(sliceCount - 1)
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
      sliceCount,
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
    if (status === 'ready') surfaceRef.current?.focus({ preventScroll: true })
  }, [status])

  // Molette = coupes (capture avant Cornerstone) ; scroll page bloqué au-dessus du viewport.
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
    return () => surface.removeEventListener('wheel', onWheel, { capture: true })
  }, [canNavigateSlices, navigateSlice])

  // Le viewport suit la taille de la surface (rail replié, rotation mobile…).
  useEffect(() => {
    const element = elementRef.current
    if (!element) return
    let raf: number | null = null
    const ro = new ResizeObserver(() => {
      if (raf !== null) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const handle = handleRef.current
        if (!handle) return
        try {
          handle.renderingEngine.resize(true, false)
        } catch {
          /* engine détruit */
        }
      })
    })
    ro.observe(element)
    return () => {
      if (raf !== null) cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  const tools: { id: DicomTool; label: string; shortLabel: string; available: boolean }[] = [
    { id: 'WindowLevel', label: 'Fenêtrage', shortLabel: 'Fenêt.', available: true },
    { id: 'ZoomAndPan', label: 'Zoom / Déplacement', shortLabel: 'Zoom', available: true },
    {
      id: 'Scroll',
      label: 'Coupes',
      shortLabel: 'Coupes',
      available: isCoarsePointer && isReady && sliceCount > 1,
    },
  ]

  const infoKind = resolveViewerInfoKind({
    isBusy,
    status,
    navMode: 'stack',
    fileCount,
    sliceCount,
  })
  const viewportMessage = viewportLoadingMessage({
    status,
    navMode: 'stack',
    fileCount,
    fileIndex: sliceIndex,
    preloadLoaded,
  })
  const preloadMode = fileCount > 1 && preloadLoaded > 0
  const hint = viewerToolHint({ navMode: 'stack', fileCount, tool, sliceCount })
  const mobileHint = viewerMobileHint({ tool, sliceCount })
  const infoNote =
    failedIndexes.size > 0
      ? `${failedIndexes.size} fichier${failedIndexes.size > 1 ? 's' : ''} illisible${failedIndexes.size > 1 ? 's' : ''} ignoré${failedIndexes.size > 1 ? 's' : ''}`
      : null

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
      navMode="stack"
      sliceCount={sliceCount}
      fileCount={fileCount}
      errorMessage={errorMessage}
      infoNote={infoNote}
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
      displaySliceIndex={sliceIndex}
      displayTotal={sliceCount}
      sliceUnit="coupe"
      hint={hint}
      mobileHint={mobileHint}
      modality={modality}
      description={activeSeries?.description}
      windowLevel={windowLevel}
      downloadHref={urls[Math.min(sliceIndex, urls.length - 1)]}
      surfaceRef={surfaceRef}
      onKeyDown={handleKeyDown}
      onSurfacePointerEnter={handleSurfacePointerEnter}
    >
      <div
        ref={elementRef}
        className="absolute inset-0"
        data-testid="dicom-cs-element"
        // Cornerstone gère ses propres gestes pointeur : pas de menu contextuel sur clic droit (zoom).
        onContextMenu={event => event.preventDefault()}
      />
    </DicomViewerChrome>
  )
}

export default DicomViewerCornerstone
