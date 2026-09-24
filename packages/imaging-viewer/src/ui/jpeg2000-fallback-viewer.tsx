'use client'

/**
 * Viewer de repli pour les DICOM JPEG 2000 que dwv ne sait pas décoder
 * (option COD « selective arithmetic coding bypass »). OpenJPEG WASM +
 * fenêtrage VOI + canvas (nav coupe, WL souris, zoom).
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type WheelEvent,
} from 'react'
import type { DicomTool, ImagingSeries } from '../contract'
import {
  accumulateWheelSlices,
  normalizeModality,
  resolveViewerInfoKind,
  windowPresetsForModality,
} from '../policy'
import { parseDicomForFallback } from './decode/dicom-j2k-extract'
import { decodeJpeg2000, type DecodedFrame } from './decode/jpeg2000-decode'
import {
  grayPixelsToRgba,
  pixelRange,
  resolveInitialWindowLevel,
  type WindowLevel,
} from './decode/dicom-windowing'
import { viewerMobileHint, viewerToolHint, viewportLoadingMessage } from './messages'
import { DicomViewerChrome } from './viewer-chrome'
import { ViewerAdvancedTools } from './viewer-advanced-tools'
import { emitImagingTelemetry, nowMs, type ImagingTelemetryHandler } from '../telemetry'

type FrameData = {
  frame: DecodedFrame
  range: { min: number; max: number }
  defaultWl: WindowLevel
  isMonochrome1: boolean
}

export type DicomJpeg2000FallbackViewerProps = {
  urls: string[]
  name: string
  fullscreen?: boolean
  onClose?: () => void
  onImagingTelemetry?: ImagingTelemetryHandler
  /** Parité host dwv (U0) : rail + nav séries pour ne pas dégrader la navigation en repli. */
  series?: ImagingSeries[]
  activeSeriesIndex?: number
  onNextSeries?: () => void
  onPrevSeries?: () => void
  onSelectSeries?: (index: number) => void
  modality?: string | null
  onDownloadSeries?: () => void | Promise<void>
  onDownloadStudy?: () => void | Promise<void>
  downloadBusy?: boolean
}

/** Remount on series change so index/cache/refs reset without setState-in-effect. */
export function DicomJpeg2000FallbackViewer(props: DicomJpeg2000FallbackViewerProps) {
  return <DicomJpeg2000FallbackViewerInner key={props.urls.join('\0')} {...props} />
}

function DicomJpeg2000FallbackViewerInner({
  urls,
  name,
  fullscreen = false,
  onClose,
  onImagingTelemetry,
  series,
  activeSeriesIndex = 0,
  onNextSeries,
  onPrevSeries,
  onSelectSeries,
  modality: modalityProp,
  onDownloadSeries,
  onDownloadStudy,
  downloadBusy = false,
}: DicomJpeg2000FallbackViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const wheelAccumRef = useRef(0)
  const [inverted, setInverted] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const [isCoarsePointer, setIsCoarsePointer] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches
  )
  const [tool, setTool] = useState<DicomTool>('WindowLevel')
  const cacheRef = useRef<Map<number, FrameData>>(new Map())
  const inflightRef = useRef<Map<number, Promise<FrameData | null>>>(new Map())
  // Sérialise les décodages : heap WASM OpenJPEG partagé.
  const decodeChainRef = useRef<Promise<unknown>>(Promise.resolve())
  const rgbaRef = useRef<ImageData | null>(null)
  const onImagingTelemetryRef = useRef(onImagingTelemetry)
  const openStartedAtRef = useRef(0)
  const paintedRef = useRef(false)
  const openReportedRef = useRef(false)

  const [index, setIndex] = useState(0)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [wl, setWl] = useState<WindowLevel | null>(null)
  const [view, setView] = useState({ zoom: 1, panX: 0, panY: 0 })
  const [decodedCount, setDecodedCount] = useState(0)

  const fileCount = urls.length

  useEffect(() => {
    onImagingTelemetryRef.current = onImagingTelemetry
  }, [onImagingTelemetry])

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const media = window.matchMedia('(pointer: coarse)')
    const onChange = (event: MediaQueryListEvent) => setIsCoarsePointer(event.matches)
    media.addEventListener?.('change', onChange)
    return () => media.removeEventListener?.('change', onChange)
  }, [])

  useEffect(() => {
    openStartedAtRef.current = nowMs()
    paintedRef.current = false
    openReportedRef.current = false
  }, [])

  useEffect(() => {
    const elapsed = () => Math.max(0, nowMs() - openStartedAtRef.current)
    if (status === 'ready' && !paintedRef.current) {
      paintedRef.current = true
      emitImagingTelemetry(onImagingTelemetryRef.current, {
        name: 'time_to_first_paint',
        durationMs: elapsed(),
        fileCount,
        engine: 'openjpeg',
        outcome: 'ready',
      })
    }
    if ((status === 'ready' || status === 'error') && !openReportedRef.current) {
      openReportedRef.current = true
      emitImagingTelemetry(onImagingTelemetryRef.current, {
        name: 'series_open_ms',
        durationMs: elapsed(),
        fileCount,
        engine: 'openjpeg',
        outcome: status === 'ready' ? 'ready' : 'error',
      })
    }
  }, [status, fileCount])

  const decodeFrame = useCallback(
    (target: number): Promise<FrameData | null> => {
      const cached = cacheRef.current.get(target)
      if (cached) return Promise.resolve(cached)
      const existing = inflightRef.current.get(target)
      if (existing) return existing
      const url = urls[target]
      if (!url) return Promise.resolve(null)

      const promise = (async () => {
        const prior = decodeChainRef.current
        let release!: () => void
        decodeChainRef.current = new Promise<void>(resolve => {
          release = resolve
        })
        await prior.catch(() => {})
        try {
          const res = await fetch(url)
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const buffer = await res.arrayBuffer()

          const parsed = parseDicomForFallback(buffer)
          if (!parsed) throw new Error('PixelData absent')

          const frame = await decodeJpeg2000(parsed.codestream)
          const range = pixelRange(frame.pixels)
          const defaultWl = resolveInitialWindowLevel({
            windowCenter: parsed.windowCenter,
            windowWidth: parsed.windowWidth,
            pixelMin: range.min,
            pixelMax: range.max,
          })

          const data: FrameData = {
            frame,
            range,
            defaultWl,
            isMonochrome1: parsed.isMonochrome1,
          }
          cacheRef.current.set(target, data)
          setDecodedCount(cacheRef.current.size)
          return data
        } finally {
          release()
        }
      })()

      inflightRef.current.set(target, promise)
      void promise.catch(() => {}).finally(() => inflightRef.current.delete(target))
      return promise
    },
    [urls]
  )

  useEffect(() => {
    let cancelled = false
    const url = urls[index]
    if (!url) return

    const cached = cacheRef.current.get(index)
    if (cached) {
      setStatus('ready')
      setErrorMessage(null)
      setWl(cached.defaultWl)
      setView({ zoom: 1, panX: 0, panY: 0 })
      return
    }

    setStatus('loading')
    setErrorMessage(null)

    void (async () => {
      try {
        const data = await decodeFrame(index)
        if (cancelled || !data) return
        setWl(data.defaultWl)
        setView({ zoom: 1, panX: 0, panY: 0 })
        setStatus('ready')
      } catch (err) {
        if (cancelled) return
        console.error('[FallbackViewer] décodage échoué', err)
        setErrorMessage(err instanceof Error ? err.message : 'décodage impossible')
        setStatus('error')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [index, urls, decodeFrame])

  useEffect(() => {
    if (status !== 'ready') return
    for (const neighbor of [index + 1, index - 1]) {
      if (neighbor >= 0 && neighbor < fileCount && !cacheRef.current.get(neighbor)) {
        void decodeFrame(neighbor).catch(() => {})
      }
    }
  }, [status, index, fileCount, decodeFrame])

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    const surface = surfaceRef.current
    const imageData = rgbaRef.current
    if (!canvas || !surface || !imageData) return

    const dpr = window.devicePixelRatio || 1
    const cssW = surface.clientWidth
    const cssH = surface.clientHeight
    if (cssW < 1 || cssH < 1) return

    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    canvas.style.width = `${cssW}px`
    canvas.style.height = `${cssH}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.save()
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const off = document.createElement('canvas')
    off.width = imageData.width
    off.height = imageData.height
    off.getContext('2d')?.putImageData(imageData, 0, 0)

    const fitScale = Math.min(cssW / imageData.width, cssH / imageData.height)
    const scale = fitScale * view.zoom * dpr
    const drawW = imageData.width * scale
    const drawH = imageData.height * scale
    const dx = (canvas.width - drawW) / 2 + view.panX * dpr
    const dy = (canvas.height - drawH) / 2 + view.panY * dpr

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.translate(flipped ? dx + drawW : dx, dy)
    ctx.scale(flipped ? -1 : 1, 1)
    ctx.drawImage(off, 0, 0, drawW, drawH)
    ctx.restore()
  }, [view, flipped])

  useEffect(() => {
    if (status !== 'ready' || !wl) return
    const data = cacheRef.current.get(index)
    if (!data) return
    // MONOCHROME1 est déjà inversé par le décodeur ; « Inverser » bascule ce choix.
    const rgba = grayPixelsToRgba(data.frame.pixels, wl, data.isMonochrome1 !== inverted)
    const imageData = new ImageData(data.frame.width, data.frame.height)
    imageData.data.set(rgba)
    rgbaRef.current = imageData
    paint()
  }, [status, wl, index, paint, inverted])

  useEffect(() => {
    paint()
  }, [paint])

  useEffect(() => {
    const surface = surfaceRef.current
    if (!surface) return
    const ro = new ResizeObserver(() => paint())
    ro.observe(surface)
    return () => ro.disconnect()
  }, [paint])

  const dragRef = useRef<{
    x: number
    y: number
    wl: WindowLevel
    pan: { x: number; y: number }
    mode: 'wl' | 'pan' | 'scroll'
    scrollAccum: number
  } | null>(null)

  const onPointerDown = (e: PointerEvent) => {
    if (status !== 'ready' || !wl) return
    ;(e.target as Element).setPointerCapture(e.pointerId)
    const mode = e.shiftKey || tool === 'ZoomAndPan' ? 'pan' : tool === 'Scroll' ? 'scroll' : 'wl'
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      wl,
      pan: { x: view.panX, y: view.panY },
      mode,
      scrollAccum: 0,
    }
  }

  const onPointerMove = (e: PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    const dx = e.clientX - drag.x
    const dy = e.clientY - drag.y
    if (drag.mode === 'scroll') {
      drag.scrollAccum += dy
      const step = Math.trunc(drag.scrollAccum / 48)
      if (step !== 0) {
        drag.scrollAccum -= step * 48
        drag.y = e.clientY
        setIndex(prev => Math.max(0, Math.min(fileCount - 1, prev - step)))
      }
      return
    }
    if (drag.mode === 'pan') {
      setView(v => ({ ...v, panX: drag.pan.x + dx, panY: drag.pan.y + dy }))
    } else {
      const data = cacheRef.current.get(index)
      const span = data ? Math.max(1, data.range.max - data.range.min) : 4096
      const sensitivity = span / 512
      setWl({
        center: drag.wl.center + dx * sensitivity,
        width: Math.max(1, drag.wl.width + dy * sensitivity),
      })
    }
  }

  const onPointerUp = (e: PointerEvent) => {
    dragRef.current = null
    try {
      ;(e.target as Element).releasePointerCapture(e.pointerId)
    } catch {
      /* noop */
    }
  }

  const zoomBy = (factor: number) => {
    setView(v => ({ ...v, zoom: Math.min(8, Math.max(0.5, v.zoom * factor)) }))
  }

  // Molette = coupes (comme le host dwv) ; Ctrl/⌘ + molette ou image unique = zoom.
  const onWheel = (e: WheelEvent) => {
    if (status !== 'ready') return
    if (fileCount <= 1 || e.ctrlKey || e.metaKey) {
      zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15)
      return
    }
    const { steps, remainder } = accumulateWheelSlices(wheelAccumRef.current, e.deltaY, e.deltaMode)
    wheelAccumRef.current = remainder
    if (steps !== 0) navigate(steps)
  }

  const resetView = () => {
    const data = cacheRef.current.get(index)
    if (data) setWl(data.defaultWl)
    setView({ zoom: 1, panX: 0, panY: 0 })
    setFlipped(false)
    setInverted(false)
  }

  const navigate = (delta: number) => {
    setIndex(prev => Math.max(0, Math.min(fileCount - 1, prev + delta)))
  }

  const goTo = (target: number) => {
    setIndex(Math.max(0, Math.min(fileCount - 1, target)))
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      navigate(-1)
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      navigate(1)
    } else if (e.key === 'PageDown') {
      e.preventDefault()
      navigate(Math.max(1, Math.round(fileCount / 10)))
    } else if (e.key === 'PageUp') {
      e.preventDefault()
      navigate(-Math.max(1, Math.round(fileCount / 10)))
    } else if (e.key === 'Home') {
      e.preventDefault()
      goTo(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      goTo(fileCount - 1)
    } else if (e.key === 'i' || e.key === 'I') {
      e.preventDefault()
      setInverted(v => !v)
    } else if (e.key === 'h' || e.key === 'H') {
      e.preventDefault()
      setFlipped(v => !v)
    } else if (e.key === 'r' || e.key === 'R') {
      e.preventDefault()
      resetView()
    }
  }

  const activeSeries = series?.[activeSeriesIndex]
  const modality = normalizeModality(modalityProp ?? activeSeries?.modality)
  const presets = windowPresetsForModality(modality)
  const infoKind = resolveViewerInfoKind({
    isBusy: status === 'loading',
    status,
    navMode: 'stack',
    fileCount,
    sliceCount: fileCount,
  })
  const unavailable = 'Indisponible sur les images JPEG 2000'
  const toolbarExtra = (
    <ViewerAdvancedTools
      measureEnabled={false}
      measureKind={null}
      measureTitle={() => unavailable}
      cineEnabled={false}
      cineTitle={fileCount < 2 ? 'Il faut au moins deux coupes' : unavailable}
      compareEnabled={false}
      compareTitle={unavailable}
      mprEnabled={false}
      mprTitle="Les trois vues (de face, de profil, du dessus) sont indisponibles sur les images JPEG 2000"
    />
  )

  return (
    <DicomViewerChrome
      name={name}
      embedded={false}
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
      sliceCount={fileCount}
      fileCount={fileCount}
      errorMessage={errorMessage}
      infoNote={null}
      preloadLoaded={decodedCount}
      preloadMode={status === 'loading' && fileCount > 1}
      progress={fileCount > 0 ? Math.round((decodedCount / fileCount) * 100) : 0}
      viewportMessage={
        status === 'loading'
          ? 'Décodage de l’image…'
          : viewportLoadingMessage({
              status,
              navMode: 'stack',
              fileCount,
              fileIndex: index,
              preloadLoaded: decodedCount,
            })
      }
      tools={[
        { id: 'WindowLevel', label: 'Fenêtrage', shortLabel: 'Fenêt.', available: true },
        { id: 'ZoomAndPan', label: 'Zoom / Déplacement', shortLabel: 'Zoom', available: true },
        {
          id: 'Scroll',
          label: 'Coupes',
          shortLabel: 'Coupes',
          available: isCoarsePointer && fileCount > 1,
          disabledTitle:
            fileCount < 2
              ? 'Une seule coupe'
              : 'Réservé à l’écran tactile : balayer pour changer de coupe',
        },
      ]}
      tool={tool}
      activateTool={setTool}
      handleZoomStep={step => zoomBy(step > 0 ? 1.15 : 1 / 1.15)}
      activePreset={null}
      presets={presets}
      applyWindowPreset={() => undefined}
      handleAutoWindow={() => {
        const data = cacheRef.current.get(index)
        if (data) setWl(data.defaultWl)
      }}
      handleReset={resetView}
      inverted={inverted}
      handleToggleInvert={() => setInverted(value => !value)}
      handleFlipHorizontal={() => setFlipped(value => !value)}
      canNavigateSlices={fileCount > 1}
      navigateSlice={navigate}
      goToSlice={goTo}
      displaySliceIndex={index}
      displayTotal={fileCount}
      sliceUnit="coupe"
      hint={viewerToolHint({ navMode: 'stack', fileCount, tool, sliceCount: fileCount })}
      mobileHint={viewerMobileHint({ tool, sliceCount: fileCount })}
      modality={modality}
      description={activeSeries?.description}
      windowLevel={wl}
      downloadHref={urls[index]}
      surfaceRef={surfaceRef}
      onKeyDown={onKeyDown}
      onSurfacePointerEnter={() => {
        const surface = surfaceRef.current
        if (surface && !surface.contains(document.activeElement)) {
          surface.focus({ preventScroll: true })
        }
      }}
      toolbarExtra={toolbarExtra}
    >
      <div
        className="absolute inset-0"
        data-testid="dicom-fallback-root"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={event => {
          event.preventDefault()
          onWheel(event)
        }}
      >
        <canvas ref={canvasRef} className="absolute inset-0" />
      </div>
    </DicomViewerChrome>
  )
}

export default DicomJpeg2000FallbackViewer
