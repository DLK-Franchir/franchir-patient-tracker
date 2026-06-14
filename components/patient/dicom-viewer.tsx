'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { App, AppOptions, ToolConfig, ViewConfig } from 'dwv'
import { ArrowLeft, ArrowRight, AlertTriangle } from 'lucide-react'

/**
 * Rendu DICOM réel pour la fiche patient du tracker (porté depuis l'app
 * questionnaires).
 *
 * dwv est une lib navigateur uniquement (DOM/canvas + web workers pour les
 * syntaxes compressées) : ce composant ne doit JAMAIS rendre côté serveur. Il
 * est chargé via next/dynamic ssr:false depuis {@link DocumentsViewer}.
 *
 * Toute la série est chargée dans un seul app dwv (loadURLs) : dwv regroupe les
 * coupes d'une même série en un volume navigable (changement de coupe instantané).
 */

type DicomViewerProps = {
  /** URLs signées courtes des objets DICOM de la série, dans l'ordre d'upload. */
  urls: string[]
  /** Libellé de la série (ou nom de fichier), pour l'accessibilité. */
  name: string
}

type DicomTool = 'WindowLevel' | 'ZoomAndPan' | 'Scroll'

type DwvLoadEvent = {
  loaded?: number
  total?: number
  error?: { message?: string } | string
}

let layerGroupCounter = 0

export default function DicomViewer({ urls, name }: DicomViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<App | null>(null)
  // Id DOM stable et sûr pour le div de layer group dwv.
  // CRITIQUE : l'id ne DOIT PAS contenir la sous-chaîne "-layer-" : dwv nomme
  // les divs de layer `<groupDivId>-layer-<n>` et retrouve le groupe en
  // splittant sur "-layer-". Un id comme `dwv-layer-group-1` casse ce lookup et
  // tue silencieusement toute interaction souris/molette.
  const [layerGroupId] = useState(() => `dwv-group-${(layerGroupCounter += 1)}`)

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [progress, setProgress] = useState(0)
  const [tool, setTool] = useState<DicomTool>('WindowLevel')
  const [sliceIndex, setSliceIndex] = useState(0)
  const [sliceCount, setSliceCount] = useState(1)

  const activateTool = useCallback((next: DicomTool) => {
    const app = appRef.current
    if (!app) return
    app.setTool(next)
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

  const navigateSlice = useCallback(
    (delta: 1 | -1) => {
      const controller = getViewController()
      if (!controller) return
      try {
        const helper = controller.getPositionHelper()
        if (delta > 0) helper.incrementPositionAlongScroll()
        else helper.decrementPositionAlongScroll()
      } catch {
        /* données mono-coupe : pas de dimension de scroll */
      }
    },
    [getViewController],
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
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const seriesUrls = urlsKey.split('\n').filter(Boolean)
    if (seriesUrls.length === 0) return

    let disposed = false
    let loadSucceeded = false

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

    const readSlicePosition = () => {
      try {
        const controller = app
          .getActiveLayerGroup()
          ?.getActiveViewLayer()
          ?.getViewController()
        if (!controller) return
        setSliceIndex(controller.getCurrentIndexScrollValue())
      } catch {
        /* position pas encore disponible */
      }
    }

    const readSliceCount = () => {
      try {
        const viewLayer = app.getActiveLayerGroup()?.getActiveViewLayer()
        if (!viewLayer) return
        const controller = viewLayer.getViewController()
        const image = app.getData(viewLayer.getDataId())?.image
        if (!image) return
        const size = image.getGeometry().getSize()
        setSliceCount(Math.max(1, size.get(controller.getScrollDimIndex())))
      } catch {
        setSliceCount(1)
      }
    }

    const onLoadProgress = (event: DwvLoadEvent) => {
      if (disposed) return
      if (typeof event.loaded === 'number') {
        const total = typeof event.total === 'number' && event.total > 0 ? event.total : 100
        setProgress(Math.min(100, Math.round((event.loaded / total) * 100)))
      }
    }

    const onLoad = () => {
      if (disposed) return
      loadSucceeded = true
      app.fitToContainer()
      app.setTool('WindowLevel')
      setTool('WindowLevel')
      readSliceCount()
      readSlicePosition()
      setStatus('ready')
    }

    const onPositionChange = () => {
      if (disposed) return
      readSlicePosition()
    }

    const onError = (event: DwvLoadEvent) => {
      if (disposed) return
      const message = typeof event.error === 'string' ? event.error : event.error?.message
      console.error('[DicomViewer] load error', message ?? event)
      if (!loadSucceeded) {
        setStatus('error')
      }
    }

    app.addEventListener('loadprogress', onLoadProgress)
    app.addEventListener('load', onLoad)
    app.addEventListener('positionchange', onPositionChange)
    app.addEventListener('loaderror', onError)
    app.addEventListener('error', onError)

    const failTimer = window.setTimeout(() => {
      if (!disposed && !loadSucceeded) {
        setStatus('error')
      }
    }, 120_000)

    app.loadURLs(seriesUrls)

    const resizeObserver = new ResizeObserver(() => {
      if (disposed) return
      app.onResize()
    })
    resizeObserver.observe(container)

    return () => {
      disposed = true
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
  }, [urlsKey, layerGroupId])

  useEffect(() => {
    if (status === 'ready') {
      surfaceRef.current?.focus({ preventScroll: true })
    }
  }, [status])

  const tools: { id: DicomTool; label: string; available: boolean }[] = [
    { id: 'WindowLevel', label: 'Fenêtrage', available: true },
    { id: 'ZoomAndPan', label: 'Zoom / Déplacement', available: true },
    { id: 'Scroll', label: 'Coupes', available: sliceCount > 1 },
  ]

  const hint =
    tool === 'ZoomAndPan'
      ? 'Glisser : déplacer · molette : zoom'
      : sliceCount > 1
        ? 'Glisser : ajuster · molette : coupes · ← → : coupes'
        : 'Glisser : ajuster'

  return (
    <div
      className="flex flex-col w-full h-full"
      style={{ backgroundColor: '#0B1020' }}
      onKeyDown={handleKeyDown}
    >
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
              disabled={status !== 'ready'}
              aria-pressed={tool === t.id}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-30"
              style={{
                backgroundColor: tool === t.id ? '#3B82F6' : 'rgba(255,255,255,0.08)',
                color: '#FFFFFF',
              }}
            >
              {t.label}
            </button>
          ))}
        <button
          type="button"
          onClick={handleReset}
          disabled={status !== 'ready'}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-white/80 hover:text-white hover:bg-white/10 transition disabled:opacity-30"
        >
          Réinitialiser
        </button>

        {sliceCount > 1 && (
          <div className="flex items-center gap-1 ml-2">
            <button
              type="button"
              onClick={() => navigateSlice(-1)}
              disabled={status !== 'ready' || sliceIndex <= 0}
              aria-label="Coupe précédente"
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
              {Math.min(sliceIndex + 1, sliceCount)} / {sliceCount}
            </span>
            <button
              type="button"
              onClick={() => navigateSlice(1)}
              disabled={status !== 'ready' || sliceIndex >= sliceCount - 1}
              aria-label="Coupe suivante"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-white/80 hover:text-white hover:bg-white/10 transition disabled:opacity-30"
            >
              Suiv.
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

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

        {status === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
            <div
              className="h-8 w-8 rounded-full border-2 border-white/20 border-t-white animate-spin"
              aria-hidden
            />
            <p className="text-xs text-white/60">
              Chargement du DICOM… {progress > 0 ? `${progress}%` : ''}
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
            <AlertTriangle className="size-8 text-white/80" strokeWidth={1.75} aria-hidden="true" />
            <p className="text-sm font-medium text-white">Impossible d&apos;afficher ce DICOM</p>
            <p className="text-xs text-white/50">
              Le fichier est peut-être corrompu, dans un format compressé non pris en charge, ou le
              lien sécurisé a expiré.
            </p>
            <a
              href={urls[0]}
              download={name}
              className="mt-2 rounded-lg px-3 py-1.5 text-xs font-medium text-white bg-white/10 hover:bg-white/20 transition"
            >
              Télécharger le fichier
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
