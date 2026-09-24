'use client'

/**
 * Host Cornerstone3D (U1 + U2) — même contrat `DicomViewerProps`, même chrome
 * que le host dwv. StackViewport `wadouri:` ; mesures non persistées, ciné,
 * comparaison 2 vues synchronisées, lignes de référence, MPR si volume valide.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Enums as csEnums } from '@cornerstonejs/core'
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
  csFlip,
  csGoToSlice,
  csNavigateSlice,
  csResetView,
  csResetWindowLevel,
  csSetWindowLevel,
  csSliceCount,
  csSliceIndex,
  csToggleInvert,
  csZoomStep,
  toImageId,
  useCornerstoneStack,
  type CsStackHandle,
} from '../engine-cs'
import { formatMeasure, pointsRequired, type MeasureKind, type Vec3 } from '../engine-cs/geometry'
import { seriesSupportsMpr } from '../engine-cs/reference'
import { DicomViewerChrome } from './viewer-chrome'
import { DicomCornerOverlay } from './viewer-corner-overlay'
import { ViewerMeasureLayer, type ProjectedAnnotation } from './viewer-measure-layer'
import { ViewerReferenceLine } from './viewer-reference-line'
import { DicomMprPanel } from './dicom-mpr-panel'
import { ViewerAdvancedTools } from './viewer-advanced-tools'
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
  onJpeg2000Unsupported,
}: DicomViewerProps) {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const elementRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<CsStackHandle | null>(null)
  const onSliceCountResolvedRef = useRef(onSliceCountResolved)
  const onImagingTelemetryRef = useRef(onImagingTelemetry)
  const onJpeg2000UnsupportedRef = useRef(onJpeg2000Unsupported)
  const openStartedAtRef = useRef(0)
  const paintedRef = useRef(false)
  const openReportedRef = useRef(false)
  const wheelAccumRef = useRef(0)
  const navigateSlicesRef = useRef<(delta: number) => void>(() => undefined)
  const compareElementRef = useRef<HTMLDivElement>(null)
  const compareHandleRef = useRef<CsStackHandle | null>(null)
  const compareNavigateRef = useRef<(delta: number) => void>(() => undefined)
  const compareSliceCountRef = useRef<((count: number) => void) | undefined>(undefined)
  const syncingRef = useRef(false)

  const [measureKind, setMeasureKind] = useState<MeasureKind | null>(null)
  const [annotations, setAnnotations] = useState<
    { id: string; kind: MeasureKind; imageId: string; points: Vec3[] }[]
  >([])
  const [draftPoints, setDraftPoints] = useState<Vec3[]>([])
  const draftRef = useRef<Vec3[]>([])
  const [cine, setCine] = useState(false)
  const [compareOn, setCompareOn] = useState(false)
  const [compareIndex, setCompareIndex] = useState(0)
  const [compareSlice, setCompareSlice] = useState(0)
  const [mprOpen, setMprOpen] = useState(false)
  const [frame, setFrame] = useState(0)

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
  useEffect(() => {
    onJpeg2000UnsupportedRef.current = onJpeg2000Unsupported
  }, [onJpeg2000Unsupported])

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
  const [seriesKey, setSeriesKey] = useState(urlsKey)
  if (seriesKey !== urlsKey) {
    setSeriesKey(urlsKey)
    setAnnotations([])
    setDraftPoints([])
    draftRef.current = []
    setMeasureKind(null)
    setCine(false)
    setCompareOn(false)
    setMprOpen(false)
  }
  const draftKey = `${sliceIndex}:${measureKind ?? ''}`
  const [draftBound, setDraftBound] = useState(draftKey)
  if (draftBound !== draftKey) {
    setDraftBound(draftKey)
    setDraftPoints([])
    draftRef.current = []
  }

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
    navigateSlicesRef,
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
    onJpeg2000UnsupportedRef,
    active: !mprOpen,
  })

  const compareSeries = compareOn ? series?.[compareIndex] : undefined
  const compareUrlsKey = compareSeries?.urls.join('\n') ?? ''
  const noopNumber = useCallback(() => undefined, [])
  const [compareStatus, setCompareStatus] = useState<'loading' | 'rendering' | 'ready' | 'error'>(
    'loading'
  )
  const [compareError, setCompareError] = useState<string | null>(null)
  const [compareSliceCount, setCompareSliceCount] = useState(1)
  const [compareWindowLevel, setCompareWindowLevel] = useState<WindowLevelState>(null)
  const [compareModality, setCompareModality] = useState<string | null>(null)

  useCornerstoneStack({
    urlsKey: compareUrlsKey,
    elementRef: compareElementRef,
    handleRef: compareHandleRef,
    capabilities,
    toolRef,
    navigateSlicesRef: compareNavigateRef,
    setStatus: setCompareStatus,
    setProgress: noopNumber,
    setPreloadLoaded: noopNumber,
    setErrorMessage: setCompareError,
    setSliceIndex: setCompareSlice,
    setSliceCount: setCompareSliceCount,
    setWindowLevel: setCompareWindowLevel,
    setModality: setCompareModality,
    setFailedIndexes: noopNumber,
    onSliceCountResolvedRef: compareSliceCountRef,
    active: compareOn && !mprOpen && compareUrlsKey.length > 0,
  })

  const activateTool = useCallback((next: DicomTool) => {
    toolRef.current = next
    setTool(next)
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

  useEffect(() => {
    navigateSlicesRef.current = navigateSlice
  }, [navigateSlice])

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
      } else if (key === 'Escape') {
        consume()
        setMeasureKind(null)
        setDraftPoints([])
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
      if (!canNavigateSlices && !compareOn) return
      const { steps, remainder } = accumulateWheelSlices(
        wheelAccumRef.current,
        event.deltaY,
        event.deltaMode
      )
      wheelAccumRef.current = remainder
      if (steps === 0) return
      const target = event.target
      if (compareOn && target instanceof Node && compareElementRef.current?.contains(target)) {
        void csNavigateSlice(compareHandleRef.current, steps)
        return
      }
      if (canNavigateSlices) navigateSlice(steps)
    }
    surface.addEventListener('wheel', onWheel, { passive: false, capture: true })
    return () => surface.removeEventListener('wheel', onWheel, { capture: true })
  }, [canNavigateSlices, navigateSlice, compareOn])

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
  }, [mprOpen, urlsKey])

  useEffect(() => {
    const element = elementRef.current
    if (!element || mprOpen) return
    const bump = () => setFrame(value => (value + 1) % 1_000_000)
    element.addEventListener(csEnums.Events.IMAGE_RENDERED, bump)
    return () => element.removeEventListener(csEnums.Events.IMAGE_RENDERED, bump)
  }, [status, mprOpen, urlsKey])

  useEffect(() => {
    if (!cine || status !== 'ready' || mprOpen) return
    const timer = window.setInterval(() => {
      const count = csSliceCount(handleRef.current)
      if (count < 2) return
      const index = csSliceIndex(handleRef.current)
      void csGoToSlice(handleRef.current, (index + 1) % count, failedIndexes)
    }, 125)
    return () => window.clearInterval(timer)
  }, [cine, status, mprOpen, failedIndexes])

  useEffect(() => {
    compareNavigateRef.current = delta => {
      void csNavigateSlice(compareHandleRef.current, delta)
    }
  }, [])

  useEffect(() => {
    if (!compareOn || syncingRef.current) return
    const other = compareHandleRef.current
    if (!other) return
    if (csSliceIndex(other) === sliceIndex) return
    syncingRef.current = true
    void csGoToSlice(other, sliceIndex).finally(() => {
      syncingRef.current = false
    })
  }, [sliceIndex, compareOn, compareUrlsKey])

  useEffect(() => {
    if (!compareOn || syncingRef.current) return
    const primary = handleRef.current
    if (!primary) return
    if (csSliceIndex(primary) === compareSlice) return
    syncingRef.current = true
    void csGoToSlice(primary, compareSlice, failedIndexes).finally(() => {
      syncingRef.current = false
    })
  }, [compareSlice, compareOn, failedIndexes])

  useEffect(() => {
    if (!compareOn || !windowLevel) return
    csSetWindowLevel(compareHandleRef.current, windowLevel.center, windowLevel.width)
  }, [compareOn, windowLevel])

  useEffect(() => {
    const element = compareElementRef.current
    if (!element || !compareOn) return
    const ro = new ResizeObserver(() => {
      try {
        compareHandleRef.current?.renderingEngine.resize(true, false)
      } catch {
        /* engine détruit */
      }
    })
    ro.observe(element)
    return () => ro.disconnect()
  }, [compareOn, compareUrlsKey])

  const placeMeasurePoint = useCallback(
    (clientX: number, clientY: number) => {
      const viewport = handleRef.current?.viewport
      if (!viewport || !measureKind) return
      const imageId = viewport.getCurrentImageId()
      if (!imageId) return
      const rect = viewport.getCanvas().getBoundingClientRect()
      let world: Vec3
      try {
        const point = viewport.canvasToWorld([clientX - rect.left, clientY - rect.top])
        world = [point[0], point[1], point[2]]
      } catch (err) {
        console.error('[DicomViewer/cs] measure point', err instanceof Error ? err.message : err)
        return
      }
      const next = [...draftRef.current, world]
      if (next.length >= pointsRequired(measureKind)) {
        draftRef.current = []
        setDraftPoints([])
        setAnnotations(current => [
          ...current,
          { id: `m-${Date.now()}`, kind: measureKind, imageId, points: next },
        ])
      } else {
        draftRef.current = next
        setDraftPoints(next)
      }
    },
    [measureKind]
  )

  const projected = useMemo(() => {
    void frame
    void sliceIndex
    const viewport = handleRef.current?.viewport
    if (!viewport) return { annotations: [] as ProjectedAnnotation[], draft: [] }
    let imageId: string | undefined
    try {
      imageId = viewport.getCurrentImageId()
    } catch {
      return { annotations: [] as ProjectedAnnotation[], draft: [] }
    }
    const project = (point: Vec3) => {
      try {
        const canvas = viewport.worldToCanvas([point[0], point[1], point[2]])
        return { x: canvas[0], y: canvas[1] }
      } catch {
        return null
      }
    }
    const visible = annotations
      .filter(annotation => annotation.imageId === imageId)
      .map(annotation => {
        const points = annotation.points
          .map(project)
          .filter((point): point is { x: number; y: number } => point !== null)
        return {
          id: annotation.id,
          kind: annotation.kind,
          points,
          label: formatMeasure(annotation.kind, annotation.points),
        }
      })
    const draft = draftPoints
      .map(project)
      .filter((point): point is { x: number; y: number } => point !== null)
    return { annotations: visible, draft }
  }, [annotations, draftPoints, frame, sliceIndex])

  const volumeOk = status === 'ready' && seriesSupportsMpr(urls.map(url => toImageId(url)))

  const selectMeasure = (kind: MeasureKind) => {
    setCine(false)
    setMprOpen(false)
    setMeasureKind(current => (current === kind ? null : kind))
  }

  const toggleCompare = () => {
    setMprOpen(false)
    if (compareOn) {
      setCompareOn(false)
      return
    }
    const next = (series ?? []).findIndex((_, index) => index !== activeSeriesIndex)
    if (next < 0) return
    setCompareIndex(next)
    setCompareOn(true)
  }

  const measureBlocked = !isReady || mprOpen
  const seriesCount = series?.length ?? 0
  const toolbarExtra = (
    <ViewerAdvancedTools
      measureEnabled={!measureBlocked}
      measureKind={measureKind}
      onMeasure={selectMeasure}
      measureTitle={() =>
        mprOpen ? 'Fermez le MPR pour mesurer' : 'Mesure sur l’image affichée, non enregistrée'
      }
      afterMeasures={
        annotations.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              setAnnotations([])
              setDraftPoints([])
              draftRef.current = []
            }}
            className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-white/80"
            data-testid="dicom-measure-clear"
          >
            Effacer
          </button>
        ) : null
      }
      cineEnabled={isReady && sliceCount > 1 && !mprOpen}
      cineOn={cine}
      onCine={() => {
        setMeasureKind(null)
        setCine(value => !value)
      }}
      cineTitle={
        sliceCount < 2 ? 'Il faut au moins deux coupes' : 'Défilement automatique des coupes'
      }
      compareEnabled={isReady && seriesCount > 1 && !mprOpen}
      compareOn={compareOn}
      onCompare={toggleCompare}
      compareTitle={
        seriesCount < 2 ? 'Il faut au moins deux séries' : 'Affiche une seconde série à côté'
      }
      compareExtra={
        compareOn && series ? (
          <select
            aria-label="Série comparée"
            value={compareIndex}
            onChange={event => setCompareIndex(Number(event.target.value))}
            className="rounded-lg bg-white/10 px-2 py-1 text-[11px] text-white"
            data-testid="dicom-compare-series"
          >
            {series.map((item, index) => (
              <option key={item.id} value={index} className="text-black">
                {item.label}
              </option>
            ))}
          </select>
        ) : null
      }
      mprEnabled={isReady && volumeOk}
      mprOn={mprOpen}
      onMpr={() => {
        setCompareOn(false)
        setMeasureKind(null)
        setCine(false)
        setMprOpen(value => !value)
      }}
      mprTitle={
        volumeOk
          ? 'Reconstruit les coupes en trois vues : de face, de profil et du dessus'
          : 'MPR impossible : les coupes n’ont pas la même taille ou le même espacement'
      }
    />
  )

  const tools: {
    id: DicomTool
    label: string
    shortLabel: string
    available: boolean
    disabledTitle?: string
  }[] = [
    { id: 'WindowLevel', label: 'Fenêtrage', shortLabel: 'Fenêt.', available: true },
    { id: 'ZoomAndPan', label: 'Zoom / Déplacement', shortLabel: 'Zoom', available: true },
    {
      id: 'Scroll',
      label: 'Coupes',
      shortLabel: 'Coupes',
      available: isCoarsePointer && sliceCount > 1,
      disabledTitle:
        sliceCount < 2
          ? 'Une seule coupe'
          : 'Réservé à l’écran tactile : balayer pour changer de coupe',
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
      toolbarExtra={toolbarExtra}
      hideCornerOverlay={compareOn}
    >
      {mprOpen ? (
        <DicomMprPanel
          imageIds={urls.map(toImageId)}
          capabilities={capabilities}
          onClose={() => setMprOpen(false)}
        />
      ) : (
        <div className="absolute inset-0 flex min-h-0">
          <div className="relative min-w-0 flex-1">
            <div ref={elementRef} className="absolute inset-0" data-testid="dicom-cs-element" />
            {compareOn && isReady ? (
              <DicomCornerOverlay
                modality={modality}
                description={activeSeries?.description}
                sliceIndex={sliceIndex}
                sliceTotal={sliceCount}
                windowLevel={windowLevel}
                inverted={inverted}
              />
            ) : null}
            <ViewerMeasureLayer
              active={measureKind !== null}
              annotations={projected.annotations}
              draft={projected.draft}
              onPlace={placeMeasurePoint}
            />
            {compareOn ? (
              <ViewerReferenceLine
                elementRef={elementRef}
                handleRef={handleRef}
                otherHandleRef={compareHandleRef}
              />
            ) : null}
          </div>
          {compareOn ? (
            <div className="relative min-w-0 flex-1 border-l border-white/15">
              <div
                ref={compareElementRef}
                className="absolute inset-0"
                data-testid="dicom-cs-compare"
              />
              {compareStatus === 'ready' ? (
                <DicomCornerOverlay
                  modality={compareModality ?? compareSeries?.modality}
                  description={compareSeries?.description}
                  sliceIndex={compareSlice}
                  sliceTotal={compareSliceCount}
                  windowLevel={compareWindowLevel}
                />
              ) : null}
              {compareStatus === 'loading' || compareStatus === 'rendering' ? (
                <p
                  className="pointer-events-none absolute bottom-2 left-2 text-[11px] text-white/70"
                  data-testid="dicom-compare-loading"
                >
                  Chargement…
                </p>
              ) : null}
              {compareStatus === 'error' && compareError ? (
                <p
                  className="absolute inset-x-3 bottom-3 text-center text-xs text-white/85"
                  data-testid="dicom-compare-error"
                >
                  {compareError}
                </p>
              ) : null}
              <ViewerReferenceLine
                elementRef={compareElementRef}
                handleRef={compareHandleRef}
                otherHandleRef={handleRef}
              />
            </div>
          ) : null}
        </div>
      )}
    </DicomViewerChrome>
  )
}

export default DicomViewerCornerstone
