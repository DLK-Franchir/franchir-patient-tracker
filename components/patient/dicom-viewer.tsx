'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { App, AppOptions, ToolConfig, ViewConfig } from 'dwv'
import { ArrowLeft, ArrowRight, AlertTriangle, Info, Activity, X } from 'lucide-react'

/**
 * SYNC: structure alignée sur Franchir_Questionnaires_Patients/src/components/clinician/DicomViewer.tsx
 * (pas de package partagé — garder les deux fichiers en parité fonctionnelle).
 */

const WL_PRESETS = [
  { id: 'soft', label: 'Tissus mous', center: 40, width: 400 },
  { id: 'bone', label: 'Os', center: 300, width: 1500 },
  { id: 'brain', label: 'Cerveau', center: 40, width: 80 },
] as const

type WlPresetId = (typeof WL_PRESETS)[number]['id']

export type ViewerSeries = {
  id: string
  label: string
  urls: string[]
  fileCount: number
}

type DicomTool = 'WindowLevel' | 'ZoomAndPan' | 'Scroll'

type DwvLoadEvent = {
  loaded?: number
  total?: number
  error?: { message?: string } | string
}

type ViewerStatus = 'loading' | 'rendering' | 'ready' | 'error'

type ViewerInfoKind = 'loading' | 'single' | 'stack' | 'partial' | 'sequential' | 'error'

type NavMode = 'stack' | 'sequential'

export type DicomViewerProps = {
  urls: string[]
  name: string
  embedded?: boolean
  fullscreen?: boolean
  series?: ViewerSeries[]
  activeSeriesIndex?: number
  onNextSeries?: () => void
  onPrevSeries?: () => void
  onClose?: () => void
  onSliceCountResolved?: (count: number) => void
}

let layerGroupCounter = 0

function ViewerInfoBubble({
  kind,
  sliceCount,
  fileCount,
  errorMessage,
}: {
  kind: ViewerInfoKind
  sliceCount: number
  fileCount: number
  errorMessage?: string | null
}) {
  if (kind === 'loading') {
    const label =
      fileCount > 1
        ? `Chargement de la série (${fileCount} fichiers)…`
        : "Chargement de l'image…"
    return (
      <span
        className="inline-flex max-w-sm items-center gap-2 rounded-lg border border-amber-400/35 bg-amber-950/80 px-3 py-1.5 text-xs font-medium text-amber-50 shadow-sm"
        data-testid="dicom-info-bubble"
      >
        <span
          className="inline-block size-3 shrink-0 rounded-full border-2 border-amber-200/30 border-t-amber-100 animate-spin"
          aria-hidden
        />
        {label}
      </span>
    )
  }

  if (kind === 'error') {
    return (
      <span
        className="inline-flex max-w-md items-start gap-2 rounded-full border border-red-400/30 bg-red-500/10 px-3 py-1 text-[11px] text-red-100"
        data-testid="dicom-info-bubble"
      >
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        <span>
          Affichage impossible
          {errorMessage
            ? ` — ${errorMessage}`
            : ' — format non pris en charge, fichier corrompu ou lien expiré'}
        </span>
      </span>
    )
  }

  if (kind === 'partial') {
    return (
      <span
        className="inline-flex max-w-md items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-950/70 px-3 py-1.5 text-xs font-medium text-amber-50 shadow-sm"
        data-testid="dicom-info-bubble"
      >
        <Info className="size-3.5 shrink-0 text-amber-300" strokeWidth={1.75} aria-hidden="true" />
        Série de {fileCount} fichiers — {sliceCount} coupe{sliceCount > 1 ? 's navigables' : ' navigable'}
      </span>
    )
  }

  if (kind === 'sequential') {
    return (
      <span
        className="inline-flex max-w-md items-center gap-2 rounded-lg border border-sky-400/40 bg-sky-950/70 px-3 py-1.5 text-xs font-medium text-sky-50 shadow-sm"
        data-testid="dicom-info-bubble"
      >
        <Info className="size-3.5 shrink-0 text-sky-300" strokeWidth={1.75} aria-hidden="true" />
        Série de {fileCount} fichiers — navigation fichier par fichier (← →)
      </span>
    )
  }

  if (kind === 'single') {
    return (
      <span
        className="inline-flex max-w-xs items-center gap-2 rounded-lg border border-white/20 bg-slate-900/90 px-3 py-1.5 text-xs font-medium text-white/90 shadow-sm"
        data-testid="dicom-info-bubble"
      >
        <Info className="size-3.5 shrink-0 text-[#38B2AC]" strokeWidth={1.75} aria-hidden="true" />
        Image unique — pas de navigation entre coupes
      </span>
    )
  }

  return (
    <span
      className="inline-flex max-w-sm items-center gap-2 rounded-lg border border-[#38B2AC]/50 bg-[#38B2AC]/25 px-3 py-1.5 text-xs font-medium text-white shadow-sm"
      data-testid="dicom-info-bubble"
    >
      <Activity className="size-3.5 shrink-0 text-[#38B2AC]" strokeWidth={1.75} aria-hidden="true" />
      Suite de {sliceCount} image{sliceCount > 1 ? 's' : ''} — ← → ou outil Coupes
    </span>
  )
}

export default function DicomViewer({
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
}: DicomViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<App | null>(null)
  const toolRef = useRef<DicomTool>('WindowLevel')
  const onSliceCountResolvedRef = useRef(onSliceCountResolved)
  const [layerGroupId] = useState(() => `dwv-group-${(layerGroupCounter += 1)}`)

  onSliceCountResolvedRef.current = onSliceCountResolved

  const [status, setStatus] = useState<ViewerStatus>('loading')
  const [progress, setProgress] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [tool, setTool] = useState<DicomTool>('WindowLevel')
  const [activePreset, setActivePreset] = useState<WlPresetId | null>(null)
  const [sliceIndex, setSliceIndex] = useState(0)
  const [sliceCount, setSliceCount] = useState(1)
  const [navMode, setNavMode] = useState<NavMode>('stack')
  const [fileIndex, setFileIndex] = useState(0)

  const fileCount = urls.length
  const isBusy = status === 'loading' || status === 'rendering'
  const isReady = status === 'ready'

  const seriesCount = series?.length ?? 0
  const hasSeriesNav = seriesCount > 1 && onNextSeries && onPrevSeries
  const showHeader = Boolean(fullscreen || onClose || hasSeriesNav)
  const atFirstSeries = activeSeriesIndex <= 0
  const atLastSeries = seriesCount > 0 ? activeSeriesIndex >= seriesCount - 1 : true

  const infoKind: ViewerInfoKind = isBusy
    ? 'loading'
    : status === 'error'
      ? 'error'
      : navMode === 'sequential' && fileCount > 1
        ? 'sequential'
        : fileCount > 1 && sliceCount > 1 && fileCount > sliceCount
          ? 'partial'
          : sliceCount > 1
            ? 'stack'
            : 'single'

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
    (event: React.KeyboardEvent<HTMLDivElement>) => {
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

  const urlsKey = urls.join('\n')

  const [prevUrlsKey, setPrevUrlsKey] = useState(urlsKey)
  if (prevUrlsKey !== urlsKey) {
    setPrevUrlsKey(urlsKey)
    setStatus('loading')
    setProgress(0)
    setSliceIndex(0)
    setSliceCount(1)
    setNavMode('stack')
    setFileIndex(0)
    setActivePreset(null)
    setErrorMessage(null)
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const seriesUrls = urlsKey.split('\n').filter(Boolean)
    if (seriesUrls.length === 0) return

    setStatus('loading')
    setProgress(0)
    setErrorMessage(null)

    const urlsToLoad =
      navMode === 'sequential' ? [seriesUrls[fileIndex] ?? seriesUrls[0]!] : seriesUrls

    let disposed = false
    let loadSucceeded = false
    let readyFallbackId: number | null = null
    let renderReadyId: number | null = null
    let layoutTimerIds: number[] = []
    let resizeRaf: number | null = null
    let pendingSequentialSwitch = false

    const app = new App()
    appRef.current = app

    const viewConfig = new ViewConfig(layerGroupId)
    const options = new AppOptions({ '*': [viewConfig] })
    options.tools = {
      Scroll: new ToolConfig(),
      ZoomAndPan: new ToolConfig(),
      WindowLevel: new ToolConfig(),
    }
    app.init(options)

    const hasRenderableImage = () => {
      try {
        const viewLayer = app.getActiveLayerGroup()?.getActiveViewLayer()
        if (!viewLayer) return false
        return Boolean(app.getData(viewLayer.getDataId())?.image)
      } catch {
        return false
      }
    }

    const readSlicePosition = () => {
      if (navMode === 'sequential') {
        setSliceIndex(fileIndex)
        return
      }
      try {
        const controller = app
          .getActiveLayerGroup()
          ?.getActiveViewLayer()
          ?.getViewController()
        if (!controller) return
        setSliceIndex(controller.getCurrentIndexScrollValue())
      } catch {
        /* position not available yet */
      }
    }

    const readSliceCount = () => {
      try {
        const viewLayer = app.getActiveLayerGroup()?.getActiveViewLayer()
        if (!viewLayer) return 1
        const controller = viewLayer.getViewController()
        const image = app.getData(viewLayer.getDataId())?.image
        if (!image) return 1
        const size = image.getGeometry().getSize()
        return Math.max(1, size.get(controller.getScrollDimIndex()))
      } catch {
        return 1
      }
    }

    const publishSliceCount = (navCount: number) => {
      const effective =
        navMode === 'sequential' && seriesUrls.length > 1 ? seriesUrls.length : navCount
      setSliceCount(effective)
      onSliceCountResolvedRef.current?.(effective)
    }

    const needsSequentialFallback = () => {
      if (seriesUrls.length <= 1) return false
      const dwvCount = readSliceCount()
      const hasImage = hasRenderableImage()
      return !hasImage || dwvCount < seriesUrls.length
    }

    const publishResolvedSliceCount = () => {
      if (navMode === 'sequential') {
        publishSliceCount(seriesUrls.length)
        return
      }
      publishSliceCount(readSliceCount())
    }

    const scheduleLayout = () => {
      for (const ms of [0, 50, 150, 400, 800]) {
        layoutTimerIds.push(
          window.setTimeout(() => {
            if (disposed || !loadSucceeded) return
            try {
              app.fitToContainer()
              app.onResize()
            } catch {
              /* layout may fail before canvas is ready */
            }
          }, ms),
        )
      }
    }

    const markReady = () => {
      if (disposed) return
      publishResolvedSliceCount()
      readSlicePosition()
      setStatus('ready')
    }

    const finalizeLoad = () => {
      if (disposed || loadSucceeded) return

      if (navMode === 'stack' && needsSequentialFallback()) {
        pendingSequentialSwitch = true
        setNavMode('sequential')
        setFileIndex(0)
        return
      }

      loadSucceeded = true
      if (readyFallbackId !== null) {
        window.clearTimeout(readyFallbackId)
        readyFallbackId = null
      }
      setStatus('rendering')
      scheduleLayout()
      const controller = app
        .getActiveLayerGroup()
        ?.getActiveViewLayer()
        ?.getViewController()
      if (controller) {
        controller.addWindowLevelPresets({
          soft: { center: 40, width: 400 },
          bone: { center: 300, width: 1500 },
          brain: { center: 40, width: 80 },
        })
      }
      app.setTool('WindowLevel')
      toolRef.current = 'WindowLevel'
      setTool('WindowLevel')
      publishResolvedSliceCount()
      readSlicePosition()
      renderReadyId = window.setTimeout(() => {
        if (navMode === 'stack' && !hasRenderableImage() && seriesUrls.length > 1) {
          pendingSequentialSwitch = true
          setNavMode('sequential')
          setFileIndex(0)
          return
        }
        markReady()
      }, 550)
    }

    const onLoadProgress = (event: DwvLoadEvent) => {
      if (disposed) return
      if (typeof event.loaded === 'number') {
        const total = typeof event.total === 'number' && event.total > 0 ? event.total : 100
        const pct = Math.min(100, Math.round((event.loaded / total) * 100))
        setProgress(pct)
        if (pct >= 100 && readyFallbackId === null) {
          readyFallbackId = window.setTimeout(() => {
            if (!disposed && !loadSucceeded && !pendingSequentialSwitch) {
              finalizeLoad()
            }
          }, 600)
        }
      }
    }

    const onLoad = () => {
      if (disposed) return
      finalizeLoad()
    }

    const onPositionChange = () => {
      if (disposed || !loadSucceeded) return
      readSlicePosition()
    }

    const onError = (event: DwvLoadEvent) => {
      if (disposed) return
      const message = typeof event.error === 'string' ? event.error : event.error?.message ?? null
      console.error('[DicomViewer] load error', message ?? event)
      const fileLabel =
        navMode === 'sequential' && seriesUrls.length > 1
          ? ` (fichier ${fileIndex + 1}/${seriesUrls.length})`
          : ''
      if (message) setErrorMessage(`${message}${fileLabel}`)
      if (!loadSucceeded) {
        const viewLayer = app.getActiveLayerGroup()?.getActiveViewLayer()
        const hasImage = Boolean(viewLayer && app.getData(viewLayer.getDataId())?.image)
        if (hasImage) {
          finalizeLoad()
        } else if (navMode === 'sequential' && seriesUrls.length > 1 && fileIndex < seriesUrls.length - 1) {
          setErrorMessage(
            `Fichier ${fileIndex + 1} illisible — passez au suivant avec →${message ? ` (${message})` : ''}`,
          )
          setStatus('ready')
          publishSliceCount(seriesUrls.length)
          setSliceIndex(fileIndex)
        } else {
          setStatus('error')
        }
      }
    }

    app.addEventListener('loadprogress', onLoadProgress)
    app.addEventListener('load', onLoad)
    app.addEventListener('positionchange', onPositionChange)
    app.addEventListener('loaderror', onError)
    app.addEventListener('error', onError)

    const failTimer = window.setTimeout(() => {
      if (!disposed && !loadSucceeded && !pendingSequentialSwitch) {
        if (navMode === 'stack' && seriesUrls.length > 1) {
          setNavMode('sequential')
          setFileIndex(0)
        } else {
          setStatus('error')
          setErrorMessage('délai de chargement dépassé')
        }
      }
    }, 120_000)

    app.loadURLs(urlsToLoad.filter(Boolean))

    const resizeObserver = new ResizeObserver((entries) => {
      if (disposed) return
      const rect = entries[0]?.contentRect
      if (!rect || rect.width < 1 || rect.height < 1) return
      if (resizeRaf !== null) cancelAnimationFrame(resizeRaf)
      resizeRaf = requestAnimationFrame(() => {
        if (disposed) return
        app.onResize()
        if (loadSucceeded) {
          app.fitToContainer()
        }
      })
    })
    resizeObserver.observe(container)

    return () => {
      disposed = true
      if (readyFallbackId !== null) window.clearTimeout(readyFallbackId)
      if (renderReadyId !== null) window.clearTimeout(renderReadyId)
      for (const id of layoutTimerIds) window.clearTimeout(id)
      if (resizeRaf !== null) cancelAnimationFrame(resizeRaf)
      window.clearTimeout(failTimer)
      resizeObserver.disconnect()
      app.removeEventListener('loadprogress', onLoadProgress)
      app.removeEventListener('load', onLoad)
      app.removeEventListener('positionchange', onPositionChange)
      app.removeEventListener('loaderror', onError)
      app.removeEventListener('error', onError)
      try {
        app.abortAllLoads()
      } catch {
        /* ignore abort races during unmount */
      }
      try {
        app.reset()
      } catch {
        /* ignore teardown races during unmount */
      }
      const node = document.getElementById(layerGroupId)
      if (node) node.replaceChildren()
      appRef.current = null
    }
  }, [urlsKey, layerGroupId, navMode, fileIndex])

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

  const tools: { id: DicomTool; label: string; available: boolean }[] = [
    { id: 'WindowLevel', label: 'Fenêtrage', available: true },
    { id: 'ZoomAndPan', label: 'Zoom / Déplacement', available: true },
    { id: 'Scroll', label: 'Coupes', available: isReady && sliceCount > 1 },
  ]

  const viewportMessage =
    status === 'rendering'
      ? "Rendu de l'image…"
      : fileCount > 1
        ? `Chargement de la série (${fileCount} fichiers)…`
        : "Chargement de l'image…"

  const displaySliceIndex = navMode === 'sequential' ? fileIndex : sliceIndex
  const canNavigateSlices = isReady && sliceCount > 1

  const hint =
    navMode === 'sequential' && sliceCount > 1
      ? '← → : fichier précédent / suivant'
      : tool === 'Scroll' && sliceCount > 1
        ? 'Molette ou ← → : changer de coupe'
        : tool === 'ZoomAndPan'
          ? 'Glisser : déplacer · molette : zoom'
          : 'Glisser : ajuster le fenêtrage (activez Coupes pour naviguer)'

  return (
    <div
      className="flex flex-col w-full h-full"
      style={{ backgroundColor: embedded && !fullscreen ? 'transparent' : '#0B1020' }}
      onKeyDown={handleKeyDown}
      data-testid="dicom-viewer-root"
    >
      {showHeader ? (
        <div
          className="flex shrink-0 flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3"
          data-testid="dicom-series-header"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-white">{name}</p>
              {seriesCount > 1 ? (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium tabular-nums text-white/60">
                  Série {activeSeriesIndex + 1} / {seriesCount}
                </span>
              ) : null}
            </div>
            <ViewerInfoBubble
              kind={infoKind}
              sliceCount={sliceCount}
              fileCount={fileCount}
              errorMessage={errorMessage}
            />
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {hasSeriesNav ? (
              <>
                <button
                  type="button"
                  onClick={onPrevSeries}
                  disabled={atFirstSeries}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
                  data-testid="dicom-prev-series"
                >
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  Série préc.
                </button>
                <button
                  type="button"
                  onClick={onNextSeries}
                  disabled={atLastSeries}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#38B2AC] px-4 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-[#38B2AC]/90 disabled:cursor-not-allowed disabled:opacity-40"
                  data-testid="dicom-next-series"
                >
                  Série suivante
                  <ArrowRight className="size-4" aria-hidden="true" />
                </button>
              </>
            ) : null}
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer la visionneuse"
                className="inline-flex items-center justify-center rounded-lg p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        className="flex flex-wrap items-center gap-2 px-3 py-2 border-b"
        style={{ borderColor: 'rgba(255,255,255,0.1)' }}
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
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-30"
              style={{
                backgroundColor: tool === t.id ? '#38B2AC' : 'rgba(255,255,255,0.08)',
                color: '#FFFFFF',
              }}
            >
              {t.label}
            </button>
          ))}

        <span className="mx-1 hidden h-4 w-px bg-white/15 sm:block" aria-hidden="true" />

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
                activePreset === preset.id ? 'rgba(56,178,172,0.35)' : 'rgba(255,255,255,0.06)',
              color: '#FFFFFF',
            }}
          >
            {preset.label}
          </button>
        ))}

        <button
          type="button"
          onClick={handleReset}
          disabled={!isReady}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-white/80 hover:text-white hover:bg-white/10 transition disabled:opacity-30"
        >
          Réinitialiser
        </button>

        {canNavigateSlices ? (
          <div className="flex items-center gap-1 ml-2">
            <button
              type="button"
              onClick={() => navigateSlice(-1)}
              disabled={displaySliceIndex <= 0}
              aria-label={navMode === 'sequential' ? 'Fichier précédent' : 'Coupe précédente'}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-white/80 hover:text-white hover:bg-white/10 transition disabled:opacity-30"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Préc.
            </button>
            <span
              className="text-xs text-white/60 tabular-nums px-1"
              aria-live="polite"
              data-testid="dicom-slice-indicator"
            >
              {displaySliceIndex + 1} / {sliceCount}
            </span>
            <button
              type="button"
              onClick={() => navigateSlice(1)}
              disabled={displaySliceIndex >= sliceCount - 1}
              aria-label={navMode === 'sequential' ? 'Fichier suivant' : 'Coupe suivante'}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-white/80 hover:text-white hover:bg-white/10 transition disabled:opacity-30"
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
          />
        ) : null}

        <span className="ml-auto text-[11px] text-white/40 hidden sm:block">{hint}</span>
      </div>

      <div
        ref={surfaceRef}
        className="relative flex-1 min-h-[360px] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/30"
        role="application"
        tabIndex={0}
        aria-label={`Visionneuse DICOM : ${name}. Flèches gauche/droite : changer de coupe.`}
        onPointerEnter={handleSurfacePointerEnter}
      >
        <div ref={containerRef} id={layerGroupId} className="absolute inset-0" />

        {isBusy ? (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none bg-[#0B1020]/85"
            data-testid="dicom-viewport-overlay"
          >
            <div
              className="h-8 w-8 rounded-full border-2 border-amber-200/30 border-t-amber-100 animate-spin"
              aria-hidden
            />
            <p className="max-w-xs px-4 text-center text-sm font-medium text-white/90">{viewportMessage}</p>
            {status === 'loading' && progress > 0 ? (
              <p className="text-xs tabular-nums text-white/50">{progress} %</p>
            ) : null}
          </div>
        ) : null}

        {status === 'error' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
            <AlertTriangle className="size-8 text-white/80" strokeWidth={1.75} aria-hidden="true" />
            <p className="text-sm font-medium text-white">Impossible d&apos;afficher ce DICOM</p>
            <p className="text-xs text-white/50">
              {errorMessage ??
                'Le fichier est peut-être corrompu, dans un format compressé non pris en charge, ou le lien sécurisé a expiré.'}
            </p>
            <a
              href={urls[0]}
              download={name}
              className="mt-2 rounded-lg px-3 py-1.5 text-xs font-medium text-white bg-white/10 hover:bg-white/20 transition"
            >
              Télécharger le fichier
            </a>
          </div>
        ) : null}
      </div>
    </div>
  )
}
