'use client'

/**
 * Viewer de repli pour les DICOM JPEG 2000 que dwv ne sait pas décoder
 * (option COD « selective arithmetic coding bypass »). OpenJPEG WASM +
 * fenêtrage VOI + canvas (nav coupe, WL souris, zoom).
 */

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent } from 'react'
import { AlertTriangle, ArrowLeft, ArrowRight, X } from 'lucide-react'
import { parseDicomForFallback } from './decode/dicom-j2k-extract'
import { decodeJpeg2000, type DecodedFrame } from './decode/jpeg2000-decode'
import {
  grayPixelsToRgba,
  pixelRange,
  resolveInitialWindowLevel,
  type WindowLevel,
} from './decode/dicom-windowing'
import { VIEWER_BG } from './messages'
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
}: DicomJpeg2000FallbackViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
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
        decodeChainRef.current = new Promise<void>((resolve) => {
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
    [urls],
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
    ctx.drawImage(off, dx, dy, drawW, drawH)
    ctx.restore()
  }, [view])

  useEffect(() => {
    if (status !== 'ready' || !wl) return
    const data = cacheRef.current.get(index)
    if (!data) return
    const rgba = grayPixelsToRgba(data.frame.pixels, wl, data.isMonochrome1)
    const imageData = new ImageData(data.frame.width, data.frame.height)
    imageData.data.set(rgba)
    rgbaRef.current = imageData
    paint()
  }, [status, wl, index, paint])

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
    mode: 'wl' | 'pan'
  } | null>(null)

  const onPointerDown = (e: PointerEvent) => {
    if (status !== 'ready' || !wl) return
    ;(e.target as Element).setPointerCapture(e.pointerId)
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      wl,
      pan: { x: view.panX, y: view.panY },
      mode: e.shiftKey ? 'pan' : 'wl',
    }
  }

  const onPointerMove = (e: PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    const dx = e.clientX - drag.x
    const dy = e.clientY - drag.y
    if (drag.mode === 'pan') {
      setView((v) => ({ ...v, panX: drag.pan.x + dx, panY: drag.pan.y + dy }))
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

  const onWheel = (e: WheelEvent) => {
    if (status !== 'ready') return
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
    setView((v) => ({ ...v, zoom: Math.min(8, Math.max(0.5, v.zoom * factor)) }))
  }

  const resetView = () => {
    const data = cacheRef.current.get(index)
    if (data) setWl(data.defaultWl)
    setView({ zoom: 1, panX: 0, panY: 0 })
  }

  const navigate = (delta: 1 | -1) => {
    setIndex((prev) => Math.max(0, Math.min(fileCount - 1, prev + delta)))
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      navigate(-1)
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      navigate(1)
    }
  }

  useEffect(() => {
    if (fileCount <= 1) return
    const handler = (e: globalThis.KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault()
        setIndex((prev) => Math.min(fileCount - 1, prev + 1))
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault()
        setIndex((prev) => Math.max(0, prev - 1))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [fileCount])

  const showHeader = Boolean(fullscreen || onClose)

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col overflow-hidden"
      style={{ backgroundColor: VIEWER_BG }}
      data-testid="dicom-fallback-root"
    >
      {showHeader ? (
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3">
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{name}</p>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer la visionneuse"
              className="inline-flex items-center justify-center rounded-lg p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex max-w-full flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2">
        <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-medium text-amber-200">
          JPEG 2000 — rendu OpenJPEG
        </span>
        <button
          type="button"
          onClick={resetView}
          disabled={status !== 'ready'}
          className="inline-flex min-h-9 items-center justify-center rounded-lg px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
        >
          Réinit.
        </button>
        {fileCount > 1 ? (
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => navigate(-1)}
              disabled={index <= 0}
              aria-label="Image précédente"
              className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10 disabled:opacity-30"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Préc.
            </button>
            <span
              className="px-1 text-xs tabular-nums text-white/60"
              data-testid="dicom-fallback-indicator"
            >
              {index + 1} / {fileCount}
            </span>
            {decodedCount < fileCount ? (
              <span
                className="hidden text-[10px] tabular-nums text-white/40 sm:inline"
                title="Coupes décodées et mises en cache"
              >
                ({decodedCount}/{fileCount} préchargées)
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => navigate(1)}
              disabled={index >= fileCount - 1}
              aria-label="Image suivante"
              className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10 disabled:opacity-30"
            >
              Suiv.
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : null}
        <span className="ml-auto hidden text-[11px] text-white/40 sm:block">
          Glisser : fenêtrage · Maj+glisser : déplacer · molette : zoom
        </span>
      </div>

      <div
        ref={surfaceRef}
        className="relative min-h-[240px] flex-1 touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/30 sm:min-h-[360px]"
        role="application"
        tabIndex={0}
        aria-label={`Visionneuse DICOM JPEG 2000 : ${name}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
      >
        <canvas ref={canvasRef} className="absolute inset-0" />

        {status === 'loading' ? (
          <div
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3"
            style={{ backgroundColor: `${VIEWER_BG}d9` }}
          >
            <div
              className="size-8 animate-spin rounded-full border-2 border-amber-200/30 border-t-amber-100"
              aria-hidden
            />
            <p className="text-sm font-medium text-white/90">Décodage de l&apos;image…</p>
          </div>
        ) : null}

        {status === 'error' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
            <AlertTriangle className="size-8 text-white/80" strokeWidth={1.75} aria-hidden="true" />
            <p className="text-sm font-medium text-white">Impossible d&apos;afficher ce DICOM</p>
            <p className="text-xs text-white/50">
              {errorMessage ?? 'Le fichier est peut-être corrompu ou illisible.'}
            </p>
            <a
              href={urls[index]}
              download={name}
              className="mt-2 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20"
            >
              Télécharger le fichier
            </a>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default DicomJpeg2000FallbackViewer
