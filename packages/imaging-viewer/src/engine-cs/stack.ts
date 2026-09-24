/**
 * Stack Cornerstone3D (U1) — un `RenderingEngine` + un `StackViewport` par host,
 * `wadouri:` sur URLs signées (fichiers Part 10 complets, pas de PACS).
 * Le stack accepte des orientations hétérogènes : plus de pool séquentiel.
 */

import { useEffect, type RefObject } from 'react'
import {
  Enums as csEnums,
  RenderingEngine,
  cache,
  eventTarget,
  getRenderingEngine,
  imageLoader,
  metaData,
  utilities as csUtils,
  type Types as CsTypes,
} from '@cornerstonejs/core'
import type { DicomTool, ViewerCapabilities } from '../contract'
import { hasPixelSignal } from '../pixel-signal'
import {
  formatDicomLoadError,
  isJpeg2000LoadFailure,
  jpeg2000UidInBytes,
  loadErrorMessage,
  normalizeModality,
} from '../policy'
import { emitImagingTelemetry, type ImagingTelemetryHandler } from '../telemetry'
import { ensureCornerstone } from './init'
import { attachCsInteractions } from './interaction'

export type CsStackHandle = {
  viewport: CsTypes.IStackViewport
  renderingEngine: RenderingEngine
  imageIds: string[]
}

export type CsStackParams = {
  urlsKey: string
  elementRef: RefObject<HTMLDivElement | null>
  handleRef: RefObject<CsStackHandle | null>
  capabilities: ViewerCapabilities
  toolRef: RefObject<DicomTool>
  /** Défilement coupes depuis les gestes (outil « Coupes » tactile). */
  navigateSlicesRef: RefObject<(delta: number) => void>
  onImagingTelemetryRef?: RefObject<ImagingTelemetryHandler | undefined>
  setStatus: (status: 'loading' | 'rendering' | 'ready' | 'error') => void
  setProgress: (value: number) => void
  setPreloadLoaded: (value: number) => void
  setErrorMessage: (value: string | null) => void
  setSliceIndex: (value: number) => void
  setSliceCount: (value: number) => void
  setWindowLevel: (value: { center: number; width: number } | null) => void
  setModality: (value: string | null) => void
  setFailedIndexes: (value: Set<number>) => void
  onSliceCountResolvedRef: RefObject<((count: number) => void) | undefined>
  /** Bascule vers le viewer OpenJPEG (radios DX JPEG 2000). */
  onJpeg2000UnsupportedRef?: RefObject<(() => void) | undefined>
  /** `false` : détruit le viewport sans en recréer (comparaison / MPR). */
  active?: boolean
}

let hostCounter = 0
function nextHostId(): string {
  hostCounter += 1
  return `franchir-cs-${hostCounter}`
}

export const CS_VIEWPORT_BACKGROUND: [number, number, number] = [0.043, 0.063, 0.125]
export const CS_RENDER_READY_FALLBACK_MS = 1500

export function toImageId(url: string): string {
  return `wadouri:${url}`
}

function readTransferSyntax(imageId: string): string | null {
  try {
    const mod = metaData.get('transferSyntax', imageId) as
      | { transferSyntaxUID?: string }
      | undefined
    return mod?.transferSyntaxUID ?? null
  } catch {
    return null
  }
}

/** Vrai seulement si l'image JPEG 2000 décodée est un aplat (canvas noir). */
function jpeg2000PixelsAreFlat(imageId: string): boolean {
  if (!isJpeg2000LoadFailure({ transferSyntax: readTransferSyntax(imageId) })) return false
  try {
    const data = cache.getImage(imageId)?.getPixelData()
    if (
      !data ||
      !(
        data instanceof Int8Array ||
        data instanceof Uint8Array ||
        data instanceof Int16Array ||
        data instanceof Uint16Array ||
        data instanceof Int32Array ||
        data instanceof Uint32Array
      )
    ) {
      return false
    }
    return !hasPixelSignal(data)
  } catch {
    return false
  }
}

/** Lit l'UID de transfer syntax dans l'en-tête, sans télécharger le pixel data. */
async function sniffJpeg2000Url(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { headers: { Range: 'bytes=0-8191' } })
    if (!response.ok && response.status !== 206) return false
    const reader = response.body?.getReader()
    if (!reader) {
      const bytes = new Uint8Array(await response.arrayBuffer())
      return jpeg2000UidInBytes(bytes) !== null
    }
    const chunks: Uint8Array[] = []
    let total = 0
    while (total < 8192) {
      const { done, value } = await reader.read()
      if (done || !value) break
      chunks.push(value)
      total += value.length
    }
    await reader.cancel().catch(() => undefined)
    const bytes = new Uint8Array(Math.min(8192, total))
    let offset = 0
    for (const chunk of chunks) {
      const count = Math.min(chunk.length, bytes.length - offset)
      bytes.set(chunk.subarray(0, count), offset)
      offset += count
      if (offset >= bytes.length) break
    }
    return jpeg2000UidInBytes(bytes) !== null
  } catch {
    return false
  }
}

function readCsWindowLevel(
  viewport: CsTypes.IStackViewport
): { center: number; width: number } | null {
  try {
    const range = viewport.getProperties().voiRange
    if (!range) return null
    // Convention DICOM (largeur = high - low + 1) — même valeur que dwv / presets.
    const wl = csUtils.windowLevel.toWindowLevel(range.lower, range.upper)
    return { center: wl.windowCenter, width: wl.windowWidth }
  } catch {
    return null
  }
}

function readCsModality(imageId: string | undefined): string | null {
  if (!imageId) return null
  try {
    const mod = metaData.get('generalSeriesModule', imageId) as { modality?: string } | undefined
    return normalizeModality(mod?.modality)
  } catch {
    return null
  }
}

/** Lifecycle du stack : init → enableElement → setStack → prefetch → events. */
export function useCornerstoneStack(params: CsStackParams) {
  const {
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
    setModality,
    setFailedIndexes,
    onSliceCountResolvedRef,
    onJpeg2000UnsupportedRef,
    active = true,
  } = params

  useEffect(() => {
    if (!active) return
    const element = elementRef.current
    if (!element) return
    const urls = urlsKey.split('\n').filter(Boolean)
    if (urls.length === 0) return

    let disposed = false
    let jpeg2000FallbackSent = false
    const hostId = nextHostId()
    const viewportId = `${hostId}-vp`
    const imageIds = urls.map(toImageId)
    const failed = new Set<number>()
    let renderingEngine: RenderingEngine | null = null
    let firstRendered = false
    let detachEvents: (() => void) | null = null
    let detachInteractions: (() => void) | null = null

    setStatus('loading')
    setProgress(0)
    setPreloadLoaded(0)
    setErrorMessage(null)
    setSliceIndex(0)
    setSliceCount(imageIds.length)
    setFailedIndexes(new Set())
    onSliceCountResolvedRef.current?.(imageIds.length)

    const fail = (message: string | null) => {
      if (disposed) return
      setErrorMessage(formatDicomLoadError(message))
      setStatus('error')
    }

    const requestJpeg2000Fallback = () => {
      if (disposed || jpeg2000FallbackSent || !capabilities.jpeg2000OpenJpegFallback) return false
      if (!onJpeg2000UnsupportedRef?.current) return false
      jpeg2000FallbackSent = true
      emitImagingTelemetry(onImagingTelemetryRef?.current, {
        name: 'openjpeg_fallback',
        navMode: 'stack',
        fileCount: imageIds.length,
        engine: 'cornerstone',
        outcome: 'fallback',
        reason: 'unsupported_j2k',
      })
      onJpeg2000UnsupportedRef?.current?.()
      return true
    }

    const jpeg2000Failure = (message: string) =>
      isJpeg2000LoadFailure({
        message,
        transferSyntax: readTransferSyntax(imageIds[0] ?? ''),
      })

    const run = async () => {
      try {
        await ensureCornerstone({
          wasmBasePath: capabilities.cornerstoneWasmBasePath,
          maxWebWorkers: Math.max(1, Math.min(4, capabilities.maxPoolLoadConcurrency)),
        })
      } catch (err) {
        fail(err instanceof Error ? err.message : 'initialisation Cornerstone impossible')
        return
      }
      if (disposed) return

      renderingEngine = new RenderingEngine(hostId)
      renderingEngine.enableElement({
        viewportId,
        type: csEnums.ViewportType.STACK,
        element,
        defaultOptions: { background: CS_VIEWPORT_BACKGROUND },
      })
      const viewport = renderingEngine.getViewport(viewportId) as CsTypes.IStackViewport

      handleRef.current = { viewport, renderingEngine, imageIds }
      detachInteractions = attachCsInteractions({
        element,
        getViewport: () => (disposed ? null : viewport),
        getTool: () => toolRef.current,
        onNavigateSlices: delta => navigateSlicesRef.current(delta),
        onWindowLevelChanged: () => {
          if (!disposed) setWindowLevel(readCsWindowLevel(viewport))
        },
      })

      const syncWl = () => {
        if (!disposed) setWindowLevel(readCsWindowLevel(viewport))
      }
      const onNewImage = () => {
        if (disposed) return
        const index = viewport.getCurrentImageIdIndex()
        setSliceIndex(index)
        if (failed.has(index)) {
          setErrorMessage(`Fichier ${index + 1} illisible — passez au suivant avec →`)
        } else {
          setErrorMessage(null)
        }
        syncWl()
      }
      const onRendered = () => {
        if (disposed || firstRendered) return
        const imageId = viewport.getCurrentImageId()
        if (imageId && jpeg2000PixelsAreFlat(imageId) && requestJpeg2000Fallback()) return
        firstRendered = true
        setModality(readCsModality(imageId))
        syncWl()
        setStatus('ready')
      }
      const onLoadError = (evt: Event) => {
        if (disposed) return
        const detail = (evt as CustomEvent<{ imageId?: string; error?: unknown }>).detail
        const index = detail?.imageId ? imageIds.indexOf(detail.imageId) : -1
        if (
          index === 0 &&
          !firstRendered &&
          jpeg2000Failure(loadErrorMessage(detail?.error)) &&
          requestJpeg2000Fallback()
        ) {
          return
        }
        if (index >= 0) {
          failed.add(index)
          setFailedIndexes(new Set(failed))
        }
      }

      element.addEventListener(csEnums.Events.STACK_NEW_IMAGE, onNewImage)
      element.addEventListener(csEnums.Events.VOI_MODIFIED, syncWl)
      element.addEventListener(csEnums.Events.IMAGE_RENDERED, onRendered)
      eventTarget.addEventListener(csEnums.Events.IMAGE_LOAD_ERROR, onLoadError)
      detachEvents = () => {
        element.removeEventListener(csEnums.Events.STACK_NEW_IMAGE, onNewImage)
        element.removeEventListener(csEnums.Events.VOI_MODIFIED, syncWl)
        element.removeEventListener(csEnums.Events.IMAGE_RENDERED, onRendered)
        eventTarget.removeEventListener(csEnums.Events.IMAGE_LOAD_ERROR, onLoadError)
      }

      try {
        await viewport.setStack(imageIds, 0)
        if (disposed) return
        if (!firstRendered) setStatus('rendering')
        setProgress(Math.round(100 / imageIds.length))
        setPreloadLoaded(1)
        viewport.render()
        // Filet : si IMAGE_RENDERED n'arrive pas (backend CPU / onglet masqué),
        // considérer prêt dès que le viewport porte des données image.
        window.setTimeout(() => {
          if (disposed || firstRendered) return
          try {
            if (viewport.getImageData()) onRendered()
          } catch {
            /* pas encore de données */
          }
        }, CS_RENDER_READY_FALLBACK_MS)
      } catch (err) {
        if (disposed) return
        const message = loadErrorMessage(err)
        if (jpeg2000Failure(message) && requestJpeg2000Fallback()) return
        if (
          capabilities.jpeg2000OpenJpegFallback &&
          urls[0] &&
          (await sniffJpeg2000Url(urls[0])) &&
          requestJpeg2000Fallback()
        ) {
          return
        }
        if (disposed) return
        emitImagingTelemetry(onImagingTelemetryRef?.current, {
          name: 'ready_without_pixels',
          navMode: 'stack',
          fileCount: imageIds.length,
          engine: 'cornerstone',
          reason: 'first_image_failed',
        })
        console.error('[DicomViewer/cs] setStack failed', message)
        fail(message)
        return
      }

      // Préchargement des autres coupes, concurrence bornée (policy).
      let loaded = 1
      let cursor = 1
      const concurrency = Math.max(1, capabilities.maxPoolLoadConcurrency)
      const pump = async (): Promise<void> => {
        while (!disposed && cursor < imageIds.length) {
          const index = cursor
          cursor += 1
          try {
            await imageLoader.loadAndCacheImage(imageIds[index]!)
          } catch (err) {
            failed.add(index)
            if (!disposed) setFailedIndexes(new Set(failed))
            console.error(
              `[DicomViewer/cs] prefetch failed file ${index + 1}`,
              err instanceof Error ? err.message : err
            )
          }
          loaded += 1
          if (!disposed) {
            setPreloadLoaded(loaded)
            setProgress(Math.round((loaded / imageIds.length) * 100))
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(concurrency, imageIds.length) }, pump))
    }

    void run()

    return () => {
      disposed = true
      detachEvents?.()
      detachInteractions?.()
      try {
        const engine = renderingEngine ?? getRenderingEngine(hostId)
        engine?.destroy()
      } catch {
        /* déjà détruit */
      }
      handleRef.current = null
    }
  }, [
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
    setModality,
    setFailedIndexes,
    onSliceCountResolvedRef,
    onJpeg2000UnsupportedRef,
    active,
  ])
}
