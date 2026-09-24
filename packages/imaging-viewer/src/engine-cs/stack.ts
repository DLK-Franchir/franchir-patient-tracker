/**
 * Stack Cornerstone3D (U1) — un `RenderingEngine` + un `StackViewport` par host,
 * `wadouri:` sur URLs signées (fichiers Part 10 complets, pas de PACS).
 * Le stack accepte des orientations hétérogènes : plus de pool séquentiel.
 */

import { useEffect, type RefObject } from 'react'
import {
  Enums as csEnums,
  RenderingEngine,
  eventTarget,
  getRenderingEngine,
  imageLoader,
  metaData,
  utilities as csUtils,
  type Types as CsTypes,
} from '@cornerstonejs/core'
import { Enums as csToolsEnums, ToolGroupManager } from '@cornerstonejs/tools'
import type { DicomTool, ViewerCapabilities } from '../contract'
import { formatDicomLoadError, normalizeModality } from '../policy'
import { emitImagingTelemetry, type ImagingTelemetryHandler } from '../telemetry'
import { CS_TOOL_NAMES, ensureCornerstone } from './init'

export type CsStackHandle = {
  viewport: CsTypes.IStackViewport
  renderingEngine: RenderingEngine
  toolGroupId: string
  imageIds: string[]
}

export type CsStackParams = {
  urlsKey: string
  elementRef: RefObject<HTMLDivElement | null>
  handleRef: RefObject<CsStackHandle | null>
  capabilities: ViewerCapabilities
  toolRef: RefObject<DicomTool>
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

/** Applique l'outil Franchir (`DicomTool`) aux bindings Cornerstone. */
export function applyCsTool(toolGroupId: string, tool: DicomTool): void {
  const group = ToolGroupManager.getToolGroup(toolGroupId)
  if (!group) return
  const { MouseBindings } = csToolsEnums
  const primary = { mouseButton: MouseBindings.Primary }
  const secondary = { mouseButton: MouseBindings.Secondary }
  const auxiliary = { mouseButton: MouseBindings.Auxiliary }
  const twoFingers = { numTouchPoints: 2 }

  // Zoom clic droit + pincement, pan bouton du milieu : constants quel que soit l'outil.
  group.setToolActive(CS_TOOL_NAMES.zoom, { bindings: [secondary, twoFingers] })
  group.setToolActive(CS_TOOL_NAMES.pan, { bindings: [auxiliary] })

  if (tool === 'WindowLevel') {
    group.setToolPassive(CS_TOOL_NAMES.stackScroll)
    group.setToolActive(CS_TOOL_NAMES.windowLevel, { bindings: [primary] })
  } else if (tool === 'ZoomAndPan') {
    group.setToolPassive(CS_TOOL_NAMES.windowLevel)
    group.setToolPassive(CS_TOOL_NAMES.stackScroll)
    group.setToolActive(CS_TOOL_NAMES.pan, { bindings: [primary, auxiliary] })
  } else {
    group.setToolPassive(CS_TOOL_NAMES.windowLevel)
    group.setToolActive(CS_TOOL_NAMES.stackScroll, { bindings: [primary] })
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
  } = params

  useEffect(() => {
    const element = elementRef.current
    if (!element) return
    const urls = urlsKey.split('\n').filter(Boolean)
    if (urls.length === 0) return

    let disposed = false
    const hostId = nextHostId()
    const viewportId = `${hostId}-vp`
    const toolGroupId = `${hostId}-tools`
    const imageIds = urls.map(toImageId)
    const failed = new Set<number>()
    let renderingEngine: RenderingEngine | null = null
    let firstRendered = false
    let detachEvents: (() => void) | null = null

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

      const toolGroup = ToolGroupManager.createToolGroup(toolGroupId)
      if (toolGroup) {
        toolGroup.addTool(CS_TOOL_NAMES.windowLevel)
        toolGroup.addTool(CS_TOOL_NAMES.pan)
        toolGroup.addTool(CS_TOOL_NAMES.zoom)
        toolGroup.addTool(CS_TOOL_NAMES.stackScroll)
        toolGroup.addViewport(viewportId, hostId)
      }
      applyCsTool(toolGroupId, toolRef.current)

      handleRef.current = { viewport, renderingEngine, toolGroupId, imageIds }

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
        firstRendered = true
        setModality(readCsModality(viewport.getCurrentImageId()))
        syncWl()
        setStatus('ready')
      }
      const onLoadError = (evt: Event) => {
        if (disposed) return
        const detail = (evt as CustomEvent<{ imageId?: string; error?: unknown }>).detail
        const index = detail?.imageId ? imageIds.indexOf(detail.imageId) : -1
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
        const message = err instanceof Error ? err.message : String(err ?? '')
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
      try {
        ToolGroupManager.destroyToolGroup(toolGroupId)
      } catch {
        /* jamais créé */
      }
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
  ])
}
