import { useEffect, type RefObject } from 'react'
import type { App } from 'dwv'
import type { DicomTool, DwvLoadEvent, ImagingPoolEntry, NavMode } from './contract'
import {
  MAX_POOL_LOAD_CONCURRENCY,
  MAX_SEQUENTIAL_POOL,
  STACK_LOAD_FAIL_MS,
  formatDicomLoadError,
  isUnsupportedJpeg2000Error,
  RENDER_READY_DELAYS_MS,
} from './policy'
import {
  addWindowLevelPresets,
  createDwvApp,
  destroyDwvApp,
  hasRenderableImage,
  waitForRenderableImage,
} from './dwv-app'
import { ensureDwvVisible, setPoolContainerVisible } from './layout'
import { nextPoolLoadIndex, POOL_BOOTSTRAP_INDEX } from './pool-plan'
import {
  emitImagingTelemetry,
  looksLikeWorkerAssetFailure,
  type ImagingTelemetryHandler,
} from './telemetry'

type PoolEntry = ImagingPoolEntry<App>

export type PoolModeParams = {
  navMode: NavMode
  urlsKey: string
  layerGroupId: string
  poolHostRef: RefObject<HTMLDivElement | null>
  poolRef: RefObject<Map<number, PoolEntry>>
  appRef: RefObject<App | null>
  fileIndexRef: RefObject<number>
  toolRef: RefObject<DicomTool>
  onSliceCountResolvedRef: RefObject<((count: number) => void) | undefined>
  onJpeg2000UnsupportedRef: RefObject<(() => void) | undefined>
  onImagingTelemetryRef?: RefObject<ImagingTelemetryHandler | undefined>
  setStatus: (status: 'loading' | 'rendering' | 'ready' | 'error') => void
  setProgress: (value: number) => void
  setPreloadLoaded: (value: number) => void
  setErrorMessage: (value: string | null) => void
  setPoolWarning: (value: string | null) => void
  setSliceIndex: (value: number) => void
  setSliceCount: (value: number) => void
}

function activatePoolFile(
  index: number,
  pool: Map<number, PoolEntry>,
  appRef: RefObject<App | null>,
  toolRef: RefObject<DicomTool>,
  setSliceIndex: (value: number) => void,
  setStatus: PoolModeParams['setStatus'],
  setErrorMessage: (value: string | null) => void,
) {
  pool.forEach((entry, i) => {
    setPoolContainerVisible(entry.container, i === index)
  })
  const entry = pool.get(index)
  if (!entry) return

  setSliceIndex(index)

  if (entry.status === 'ready') {
    appRef.current = entry.app
    try {
      entry.app.setTool(toolRef.current)
      ensureDwvVisible(entry.app, () => entry.status === 'ready')
    } catch {
      /* layout may fail before canvas is ready */
    }
    setStatus('ready')
    setErrorMessage(null)
  } else if (entry.status === 'error') {
    appRef.current = entry.app
    setErrorMessage(
      `Fichier ${index + 1} illisible — passez au suivant avec →${
        entry.errorMessage ? ` (${entry.errorMessage})` : ''
      }`,
    )
    setStatus('ready')
  } else {
    appRef.current = entry.app
    setStatus('rendering')
    setErrorMessage(null)
  }
}

/** Mode séquentiel : pool d'Apps (un par fichier), préchargement parallèle. */
export function useDicomSequentialPool(params: PoolModeParams) {
  const {
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
  } = params

  useEffect(() => {
    if (navMode !== 'sequential') return
    const poolHost = poolHostRef.current
    if (!poolHost) return

    const seriesUrls = urlsKey.split('\n').filter(Boolean)
    if (seriesUrls.length <= 1) return

    const poolSize = Math.min(seriesUrls.length, MAX_SEQUENTIAL_POOL)

    setStatus('loading')
    setProgress(0)
    setPreloadLoaded(0)
    setErrorMessage(null)
    setSliceCount(seriesUrls.length)
    setSliceIndex(0)
    onSliceCountResolvedRef.current?.(seriesUrls.length)
    if (seriesUrls.length > MAX_SEQUENTIAL_POOL) {
      setPoolWarning(
        `Série volumineuse (${seriesUrls.length} fichiers) — seuls les ${MAX_SEQUENTIAL_POOL} premiers sont préchargés.`,
      )
    } else {
      setPoolWarning(null)
    }

    let disposed = false
    let jpeg2000FallbackTriggered = false
    let processedCount = 0
    let firstActivated = false
    let resizeRaf: number | null = null
    const pool = new Map<number, PoolEntry>()
    poolRef.current = pool
    poolHost.replaceChildren()
    appRef.current = null

    const updatePreloadProgress = () => {
      if (disposed) return
      setPreloadLoaded(processedCount)
    }

    let poolLoadCursor = 0
    let poolLoadsInFlight = 0
    let bootstrapComplete = poolSize <= 1

    const markEntryProcessed = (index: number, app: App, success: boolean, errMsg?: string) => {
      if (disposed) return
      const entry = pool.get(index)
      if (!entry || entry.status !== 'loading') return

      if (success) {
        entry.status = 'ready'
        addWindowLevelPresets(app)
        app.setTool('WindowLevel')
      } else {
        entry.status = 'error'
        entry.errorMessage = errMsg ?? 'erreur de chargement'
      }

      poolLoadsInFlight = Math.max(0, poolLoadsInFlight - 1)
      processedCount += 1
      updatePreloadProgress()

      if (index === POOL_BOOTSTRAP_INDEX) {
        bootstrapComplete = true
      }

      const activeIndex = fileIndexRef.current
      if (!firstActivated) {
        firstActivated = true
        activatePoolFile(
          activeIndex,
          pool,
          appRef,
          toolRef,
          setSliceIndex,
          setStatus,
          setErrorMessage,
        )
      } else if (activeIndex === index) {
        activatePoolFile(index, pool, appRef, toolRef, setSliceIndex, setStatus, setErrorMessage)
      }
    }

    const startPoolLoad = (index: number) => {
      const entry = pool.get(index)
      if (!entry || entry.status !== 'loading') return
      const url = seriesUrls[index]
      if (!url) return

      const app = entry.app
      if (index === POOL_BOOTSTRAP_INDEX) {
        setPoolContainerVisible(entry.container, true)
      }

      const finalizeEntry = (success: boolean, errMsg?: string) => {
        if (disposed) return
        markEntryProcessed(
          index,
          app,
          success,
          errMsg ?? (success ? undefined : 'fichier illisible ou format non pris en charge'),
        )
        pumpPoolLoads()
      }

      const onLoad = () => {
        if (disposed) return
        // Chemin sync si pixels déjà présents (tests / non compressé).
        if (hasRenderableImage(app)) {
          finalizeEntry(true)
          return
        }
        void waitForRenderableImage(app, RENDER_READY_DELAYS_MS).then((ready) => {
          if (ready) {
            finalizeEntry(true)
            return
          }
          // Chargé sans pixels exploitables → échec silencieux du codec.
          emitImagingTelemetry(onImagingTelemetryRef?.current, {
            name: 'ready_without_pixels',
            navMode: 'sequential',
            fileCount: seriesUrls.length,
            engine: 'dwv',
            reason: 'empty_pixel_buffer',
          })
          finalizeEntry(false, formatDicomLoadError('décodage du flux compressé impossible (codec)'))
        })
      }

      const onError = (event: DwvLoadEvent) => {
        if (disposed) return
        const message =
          typeof event.error === 'string' ? event.error : (event.error?.message ?? null)
        if (isUnsupportedJpeg2000Error(message)) {
          if (!jpeg2000FallbackTriggered) {
            jpeg2000FallbackTriggered = true
            emitImagingTelemetry(onImagingTelemetryRef?.current, {
              name: 'openjpeg_fallback',
              navMode: 'sequential',
              fileCount: seriesUrls.length,
              engine: 'dwv',
              outcome: 'fallback',
              reason: 'unsupported_j2k',
            })
            onJpeg2000UnsupportedRef.current?.()
          }
          return
        }
        if (looksLikeWorkerAssetFailure(message)) {
          emitImagingTelemetry(onImagingTelemetryRef?.current, {
            name: 'worker_asset_fail',
            navMode: 'sequential',
            fileCount: seriesUrls.length,
            engine: 'dwv',
            reason: 'worker_script',
          })
        }
        console.error(`[DicomViewer] pool load error file ${index + 1}`, message ?? event)
        finalizeEntry(false, formatDicomLoadError(message ?? 'erreur de chargement'))
      }

      app.addEventListener('load', onLoad)
      app.addEventListener('loaderror', onError)
      app.addEventListener('error', onError)
      app.loadURLs([url])
    }

    const pumpPoolLoads = () => {
      if (disposed) return
      while (poolLoadsInFlight < MAX_POOL_LOAD_CONCURRENCY) {
        const index = nextPoolLoadIndex(poolLoadCursor, poolSize, bootstrapComplete)
        if (index === null) break
        poolLoadCursor = index + 1
        poolLoadsInFlight += 1
        startPoolLoad(index)
      }
    }

    for (let i = 0; i < poolSize; i++) {
      const fileLayerGroupId = `${layerGroupId}-seq-${i}`
      const fileContainer = document.createElement('div')
      fileContainer.id = fileLayerGroupId
      fileContainer.className = 'absolute inset-0'
      setPoolContainerVisible(fileContainer, i === POOL_BOOTSTRAP_INDEX)
      poolHost.appendChild(fileContainer)

      const app = createDwvApp(fileLayerGroupId)
      pool.set(i, {
        app,
        container: fileContainer,
        layerGroupId: fileLayerGroupId,
        status: 'loading',
      })
    }

    pumpPoolLoads()

    const resizeObserver = new ResizeObserver((entries) => {
      if (disposed) return
      const rect = entries[0]?.contentRect
      if (!rect || rect.width < 1 || rect.height < 1) return
      if (resizeRaf !== null) cancelAnimationFrame(resizeRaf)
      resizeRaf = requestAnimationFrame(() => {
        if (disposed) return
        const active = pool.get(fileIndexRef.current)
        if (active?.status === 'ready') {
          try {
            active.app.onResize()
            active.app.fitToContainer()
          } catch {
            /* ignore */
          }
        }
      })
    })
    resizeObserver.observe(poolHost)

    const failTimer = window.setTimeout(() => {
      if (!disposed && !firstActivated) {
        setStatus('error')
        setErrorMessage('délai de chargement dépassé')
      }
    }, STACK_LOAD_FAIL_MS)

    return () => {
      disposed = true
      window.clearTimeout(failTimer)
      if (resizeRaf !== null) cancelAnimationFrame(resizeRaf)
      resizeObserver.disconnect()
      pool.forEach((entry) => {
        destroyDwvApp(entry.app, entry.layerGroupId)
      })
      pool.clear()
      poolRef.current = new Map()
      poolHost.replaceChildren()
      appRef.current = null
    }
  }, [
    urlsKey,
    layerGroupId,
    navMode,
    appRef,
    fileIndexRef,
    onSliceCountResolvedRef,
    onJpeg2000UnsupportedRef,
    poolHostRef,
    poolRef,
    setErrorMessage,
    setPoolWarning,
    setPreloadLoaded,
    setProgress,
    setSliceCount,
    setSliceIndex,
    setStatus,
    toolRef,
  ])
}
