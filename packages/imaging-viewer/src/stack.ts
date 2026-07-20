import { useEffect, type RefObject } from 'react'
import type { App } from 'dwv'
import type { DicomTool, DwvLoadEvent, NavMode } from './contract'
import {
  STACK_LOAD_FAIL_MS,
  STACK_PROGRESS_FALLBACK_MS,
  STACK_RENDER_READY_MS,
  RENDER_READY_DELAYS_MS,
  formatDicomLoadError,
  isStackOrientationMismatch,
  isUnsupportedJpeg2000Error,
  orientationFallbackMessage,
} from './policy'
import {
  addWindowLevelPresets,
  createDwvApp,
  destroyDwvApp,
  hasRenderableImage,
  readSliceCount,
  readSliceIndex,
  waitForRenderableImage,
} from './dwv-app'
import { clearLayoutTimers, scheduleLayoutRetries } from './layout'
import {
  emitImagingTelemetry,
  looksLikeWorkerAssetFailure,
  type ImagingTelemetryHandler,
} from './telemetry'

export type StackModeParams = {
  navMode: NavMode
  urlsKey: string
  /** Libellé série (détecte localizer multi-plans pour le message d'orientation). */
  seriesName?: string | null
  layerGroupId: string
  containerRef: RefObject<HTMLDivElement | null>
  appRef: RefObject<App | null>
  toolRef: RefObject<DicomTool>
  onSliceCountResolvedRef: RefObject<((count: number) => void) | undefined>
  onJpeg2000UnsupportedRef: RefObject<(() => void) | undefined>
  onImagingTelemetryRef?: RefObject<ImagingTelemetryHandler | undefined>
  setNavMode: (mode: NavMode) => void
  setFileIndex: (index: number) => void
  setStatus: (status: 'loading' | 'rendering' | 'ready' | 'error') => void
  setProgress: (value: number) => void
  setPreloadLoaded: (value: number) => void
  setErrorMessage: (value: string | null) => void
  setPoolWarning: (value: string | null) => void
  setSequentialFallbackNote: (value: string | null) => void
  setSliceIndex: (value: number) => void
  setSliceCount: (value: number) => void
  setTool: (tool: DicomTool) => void
  setActivePreset: (preset: null) => void
}

/** Mode stack : un App dwv, chargement groupé ; bascule séquentiel si échec. */
export function useDicomStackMode(params: StackModeParams) {
  const {
    navMode,
    urlsKey,
    seriesName,
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
  } = params

  useEffect(() => {
    if (navMode !== 'stack') return
    const container = containerRef.current
    if (!container) return

    const seriesUrls = urlsKey.split('\n').filter(Boolean)
    if (seriesUrls.length === 0) return

    setStatus('loading')
    setProgress(0)
    setPreloadLoaded(0)
    setErrorMessage(null)
    setPoolWarning(null)

    let disposed = false
    let loadSucceeded = false
    let readyFallbackId: number | null = null
    let renderReadyId: number | null = null
    let layoutTimerIds: number[] = []
    let resizeRaf: number | null = null
    let pendingSequentialSwitch = false

    const app = createDwvApp(layerGroupId)
    appRef.current = app

    const publishSliceCount = (navCount: number) => {
      setSliceCount(navCount)
      onSliceCountResolvedRef.current?.(navCount)
    }

    const needsSequentialFallback = () => {
      if (seriesUrls.length <= 1) return false
      const dwvCount = readSliceCount(app)
      const hasImage = hasRenderableImage(app)
      return !hasImage || dwvCount < seriesUrls.length
    }

    const switchToSequentialFallback = (orientationNote?: string) => {
      pendingSequentialSwitch = true
      setErrorMessage(null)
      if (orientationNote) setSequentialFallbackNote(orientationNote)
      setNavMode('sequential')
      setFileIndex(0)
    }

    const markReady = () => {
      if (disposed) return
      publishSliceCount(readSliceCount(app))
      const index = readSliceIndex(app)
      if (index !== null) setSliceIndex(index)
      setStatus('ready')
    }

    const finalizeLoad = () => {
      if (disposed || loadSucceeded) return

      if (needsSequentialFallback()) {
        switchToSequentialFallback()
        return
      }

      loadSucceeded = true
      if (readyFallbackId !== null) {
        window.clearTimeout(readyFallbackId)
        readyFallbackId = null
      }
      setStatus('rendering')
      layoutTimerIds = scheduleLayoutRetries(app, () => !disposed && loadSucceeded)
      addWindowLevelPresets(app)
      app.setTool('WindowLevel')
      toolRef.current = 'WindowLevel'
      setTool('WindowLevel')
      publishSliceCount(readSliceCount(app))
      const index = readSliceIndex(app)
      if (index !== null) setSliceIndex(index)
      renderReadyId = window.setTimeout(() => {
        // Chemin sync si pixels déjà présents (évite microtask Promise en tests /
        // cas non compressé). Sinon poll worker JPEG 2000.
        if (hasRenderableImage(app)) {
          markReady()
          return
        }
        void waitForRenderableImage(app, RENDER_READY_DELAYS_MS).then((ready) => {
          if (!ready && seriesUrls.length > 1) {
            switchToSequentialFallback()
            return
          }
          if (!ready) {
            // Géométrie présente mais aucun pixel décodé → échec silencieux du
            // codec (worker manquant / format non géré). Erreur explicite plutôt
            // qu'un canvas noir « prêt ».
            emitImagingTelemetry(onImagingTelemetryRef?.current, {
              name: 'ready_without_pixels',
              navMode: 'stack',
              fileCount: seriesUrls.length,
              engine: 'dwv',
              reason: 'empty_pixel_buffer',
            })
            setStatus('error')
            setErrorMessage(
              formatDicomLoadError('décodage du flux compressé impossible (codec)'),
            )
            return
          }
          markReady()
        })
      }, STACK_RENDER_READY_MS)
    }

    const onLoadProgress = (event: DwvLoadEvent) => {
      if (disposed) return
      if (typeof event.loaded === 'number') {
        const total = typeof event.total === 'number' && event.total > 0 ? event.total : 100
        const pct = Math.min(100, Math.round((event.loaded / total) * 100))
        setProgress(pct)
        if (seriesUrls.length > 1) {
          const estimated = Math.max(
            1,
            Math.min(seriesUrls.length, Math.round((pct / 100) * seriesUrls.length)),
          )
          setPreloadLoaded(estimated)
        }
        if (pct >= 100 && readyFallbackId === null) {
          readyFallbackId = window.setTimeout(() => {
            if (!disposed && !loadSucceeded && !pendingSequentialSwitch) {
              finalizeLoad()
            }
          }, STACK_PROGRESS_FALLBACK_MS)
        }
      }
    }

    const onLoad = () => {
      if (disposed) return
      if (seriesUrls.length > 1) {
        setPreloadLoaded(seriesUrls.length)
      }
      finalizeLoad()
    }

    const onPositionChange = () => {
      if (disposed || !loadSucceeded) return
      const index = readSliceIndex(app)
      if (index !== null) setSliceIndex(index)
    }

    const onError = (event: DwvLoadEvent) => {
      if (disposed) return
      const message =
        typeof event.error === 'string' ? event.error : (event.error?.message ?? null)

      if (isUnsupportedJpeg2000Error(message)) {
        emitImagingTelemetry(onImagingTelemetryRef?.current, {
          name: 'openjpeg_fallback',
          navMode: 'stack',
          fileCount: seriesUrls.length,
          engine: 'dwv',
          outcome: 'fallback',
          reason: 'unsupported_j2k',
        })
        onJpeg2000UnsupportedRef.current?.()
        return
      }

      if (looksLikeWorkerAssetFailure(message)) {
        emitImagingTelemetry(onImagingTelemetryRef?.current, {
          name: 'worker_asset_fail',
          navMode: 'stack',
          fileCount: seriesUrls.length,
          engine: 'dwv',
          reason: 'worker_script',
        })
      }

      if (isStackOrientationMismatch(message) && seriesUrls.length > 1) {
        switchToSequentialFallback(orientationFallbackMessage(seriesName))
        return
      }

      console.error('[DicomViewer] load error', message ?? event)

      if (loadSucceeded) {
        if (message) setErrorMessage(formatDicomLoadError(message))
        return
      }

      const viewLayer = app.getActiveLayerGroup()?.getActiveViewLayer()
      const hasImage = Boolean(viewLayer && app.getData(viewLayer.getDataId())?.image)
      if (hasImage) {
        finalizeLoad()
      } else if (seriesUrls.length > 1) {
        switchToSequentialFallback()
      } else {
        if (message) setErrorMessage(formatDicomLoadError(message))
        setStatus('error')
      }
    }

    app.addEventListener('loadprogress', onLoadProgress)
    app.addEventListener('load', onLoad)
    app.addEventListener('positionchange', onPositionChange)
    app.addEventListener('loaderror', onError)
    app.addEventListener('error', onError)

    const failTimer = window.setTimeout(() => {
      if (!disposed && !loadSucceeded && !pendingSequentialSwitch) {
        if (seriesUrls.length > 1) {
          switchToSequentialFallback()
        } else {
          setStatus('error')
          setErrorMessage('délai de chargement dépassé')
        }
      }
    }, STACK_LOAD_FAIL_MS)

    app.loadURLs(seriesUrls.filter(Boolean))

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
      clearLayoutTimers(layoutTimerIds)
      if (resizeRaf !== null) cancelAnimationFrame(resizeRaf)
      window.clearTimeout(failTimer)
      resizeObserver.disconnect()
      app.removeEventListener('loadprogress', onLoadProgress)
      app.removeEventListener('load', onLoad)
      app.removeEventListener('positionchange', onPositionChange)
      app.removeEventListener('loaderror', onError)
      app.removeEventListener('error', onError)
      destroyDwvApp(app, layerGroupId)
      appRef.current = null
    }
  }, [
    urlsKey,
    seriesName,
    layerGroupId,
    navMode,
    appRef,
    containerRef,
    onSliceCountResolvedRef,
    onJpeg2000UnsupportedRef,
    setActivePreset,
    setErrorMessage,
    setFileIndex,
    setNavMode,
    setPoolWarning,
    setSequentialFallbackNote,
    setPreloadLoaded,
    setProgress,
    setSliceCount,
    setSliceIndex,
    setStatus,
    setTool,
    toolRef,
  ])
}
