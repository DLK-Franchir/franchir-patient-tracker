'use client'

/**
 * MPR conditionnel (U2) — trois vues orthogonales si la série est un volume
 * homogène (même orientation, espacement, taille). Sinon un message, pas d'erreur.
 *
 * Les gestes (fenêtrage, zoom, pan, molette = coupes) et les boutons chrome
 * (zoom +/-, Auto, Inverser, Miroir, Réinit.) s'appliquent aux viewports MPR,
 * pas à la pile stack fermée pendant que le MPR est ouvert.
 */

import { useEffect, useRef, useState, type MutableRefObject, type RefObject } from 'react'
import {
  Enums as csEnums,
  RenderingEngine,
  getRenderingEngine,
  setVolumesForViewports,
  utilities as csUtils,
  volumeLoader,
  cache,
  type Types as CsTypes,
} from '@cornerstonejs/core'
import type { DicomTool, ViewerCapabilities } from '../contract'
import { CS_VIEWPORT_BACKGROUND } from '../engine-cs/stack'
import { ensureCornerstone } from '../engine-cs/init'
import { attachCsInteractions, clampZoom } from '../engine-cs/interaction'
import { seriesSupportsMpr } from '../engine-cs/reference'

const MPR_UNAVAILABLE =
  'MPR reconstruit les coupes en trois vues : de face, de profil et du dessus. Cette série ne peut pas l’être : les coupes n’ont pas la même taille ou le même espacement.'

const MPR_FAILED =
  'MPR reconstruit les coupes en trois vues : de face, de profil et du dessus. Le calcul a échoué pour cette série. Les coupes habituelles restent disponibles.'

function mprReason(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err ?? '')
  return text.replace(/https?:\/\/\S+/g, '[url]').slice(0, 180)
}

const PLANES = [
  { id: 'axial', label: 'Axial', orientation: csEnums.OrientationAxis.AXIAL },
  { id: 'sagittal', label: 'Sagittal', orientation: csEnums.OrientationAxis.SAGITTAL },
  { id: 'coronal', label: 'Coronal', orientation: csEnums.OrientationAxis.CORONAL },
] as const

type VolumeViewport = CsTypes.IVolumeViewport

export type DicomMprApi = {
  navigateSlices: (delta: number) => void
  zoomStep: (step: number) => void
  resetView: () => void
  toggleInvert: () => boolean | null
  flipHorizontal: () => void
  resetWindowLevel: () => void
  setWindowLevel: (center: number, width: number) => void
}

function scrollViewport(viewport: VolumeViewport | null, delta: number) {
  if (!viewport || delta === 0) return
  try {
    csUtils.scroll(viewport as never, { delta })
  } catch {
    try {
      if ('scroll' in viewport && typeof viewport.scroll === 'function') {
        viewport.scroll(delta)
      }
    } catch {
      /* viewport détruit */
    }
  }
}

function eachViewport(
  engine: RenderingEngine | undefined,
  viewportIds: string[],
  fn: (viewport: VolumeViewport) => void
) {
  if (!engine) return
  for (const id of viewportIds) {
    try {
      const viewport = engine.getViewport(id) as VolumeViewport | undefined
      if (viewport) fn(viewport)
    } catch {
      /* viewport détruit */
    }
  }
}

export function DicomMprPanel({
  imageIds,
  capabilities,
  onClose,
  getTool,
  toolRef,
  apiRef,
}: {
  imageIds: string[]
  capabilities: ViewerCapabilities
  onClose: () => void
  getTool: () => DicomTool
  /** Mis à jour quand l'outil chrome change (fenêtrage / zoom / coupes). */
  toolRef: RefObject<DicomTool>
  apiRef: MutableRefObject<DicomMprApi | null>
}) {
  const axialRef = useRef<HTMLDivElement | null>(null)
  const sagittalRef = useRef<HTMLDivElement | null>(null)
  const coronalRef = useRef<HTMLDivElement | null>(null)
  const focusedIndexRef = useRef(1)
  const engineIdRef = useRef<string | null>(null)
  const viewportIdsRef = useRef<string[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const imageKey = imageIds.join('\n')
  const supported = seriesSupportsMpr(imageKey.split('\n').filter(Boolean))

  useEffect(() => {
    if (!supported) {
      apiRef.current = null
      return
    }
    const ids = imageKey.split('\n').filter(Boolean)
    const elements = [axialRef.current, sagittalRef.current, coronalRef.current]
    if (elements.some(el => !el)) return

    let disposed = false
    const engineId = `franchir-mpr-${Date.now()}`
    const volumeId = `cornerstoneStreamingImageVolume:${engineId}`
    const viewportIds = PLANES.map(plane => `${engineId}-${plane.id}`)
    engineIdRef.current = engineId
    viewportIdsRef.current = viewportIds
    let detach: Array<() => void> = []

    const fail = (err: unknown) => {
      if (disposed) return
      console.error('[DicomViewer/cs] MPR', mprReason(err))
      setMessage(MPR_FAILED)
      apiRef.current = null
    }

    const getEngine = () => {
      try {
        return getRenderingEngine(engineId)
      } catch {
        return undefined
      }
    }

    const getFocused = (): VolumeViewport | null => {
      const engine = getEngine()
      if (!engine) return null
      const id = viewportIds[focusedIndexRef.current] ?? viewportIds[1]
      if (!id) return null
      try {
        return engine.getViewport(id) as VolumeViewport
      } catch {
        return null
      }
    }

    const api: DicomMprApi = {
      navigateSlices: delta => scrollViewport(getFocused(), delta),
      zoomStep: step => {
        const viewport = getFocused()
        if (!viewport) return
        try {
          viewport.setZoom(clampZoom(viewport.getZoom() * (1 + step)))
          viewport.render()
        } catch {
          /* viewport détruit */
        }
      },
      resetView: () => {
        eachViewport(getEngine(), viewportIds, viewport => {
          try {
            viewport.resetCamera()
            viewport.resetProperties()
            viewport.render()
          } catch {
            /* viewport détruit */
          }
        })
      },
      toggleInvert: () => {
        let next: boolean | null = null
        eachViewport(getEngine(), viewportIds, viewport => {
          try {
            const props = viewport.getProperties() ?? {}
            const value = !Boolean((props as { invert?: boolean }).invert)
            viewport.setProperties({ invert: value })
            viewport.render()
            next = value
          } catch {
            /* viewport détruit */
          }
        })
        return next
      },
      flipHorizontal: () => {
        eachViewport(getEngine(), viewportIds, viewport => {
          try {
            const camera = viewport.getCamera()
            viewport.setCamera({ flipHorizontal: !camera?.flipHorizontal })
            viewport.render()
          } catch {
            /* viewport détruit */
          }
        })
      },
      resetWindowLevel: () => {
        eachViewport(getEngine(), viewportIds, viewport => {
          try {
            const props = viewport.getProperties() ?? {}
            const invert = Boolean((props as { invert?: boolean }).invert)
            viewport.resetProperties()
            if (invert) viewport.setProperties({ invert: true })
            viewport.render()
          } catch {
            /* viewport détruit */
          }
        })
      },
      setWindowLevel: (center, width) => {
        eachViewport(getEngine(), viewportIds, viewport => {
          try {
            viewport.setProperties({
              voiRange: csUtils.windowLevel.toLowHighRange(width, center),
            })
            viewport.render()
          } catch {
            /* viewport détruit */
          }
        })
      },
    }

    const run = async () => {
      await new Promise<void>(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
      if (disposed) return
      try {
        await ensureCornerstone({
          wasmBasePath: capabilities.cornerstoneWasmBasePath,
          maxWebWorkers: Math.max(1, Math.min(4, capabilities.maxPoolLoadConcurrency)),
        })
      } catch (err) {
        fail(err)
        return
      }
      if (disposed) return

      const engine = new RenderingEngine(engineId)
      PLANES.forEach((plane, index) => {
        const element = elements[index]!
        engine.enableElement({
          viewportId: viewportIds[index]!,
          type: csEnums.ViewportType.ORTHOGRAPHIC,
          element,
          defaultOptions: {
            orientation: plane.orientation,
            background: CS_VIEWPORT_BACKGROUND,
          },
        })
        const onFocus = () => {
          focusedIndexRef.current = index
        }
        element.addEventListener('pointerenter', onFocus)
        detach.push(() => element.removeEventListener('pointerenter', onFocus))
        detach.push(
          attachCsInteractions({
            element,
            getViewport: () => {
              try {
                return engine.getViewport(viewportIds[index]!) as never
              } catch {
                return null
              }
            },
            getTool: () => toolRef.current ?? getTool(),
            enableWheel: true,
            onNavigateSlices: delta => {
              try {
                const viewport = engine.getViewport(viewportIds[index]!) as VolumeViewport
                scrollViewport(viewport, delta)
              } catch {
                /* viewport détruit */
              }
            },
          })
        )
      })

      try {
        const volume = await volumeLoader.createAndCacheVolume(volumeId, { imageIds: ids })
        if (disposed) return
        if ('load' in volume && typeof volume.load === 'function') {
          await volume.load()
        }
        if (disposed) return
        await setVolumesForViewports(engine, [{ volumeId }], viewportIds, true)
        if (!disposed) {
          apiRef.current = api
          setReady(true)
        }
      } catch (err) {
        fail(err)
      }
    }

    void run()

    const ro = new ResizeObserver(() => {
      try {
        getRenderingEngine(engineId)?.resize(true, false)
      } catch {
        /* engine détruit */
      }
    })
    elements.forEach(el => {
      if (el) ro.observe(el)
    })

    return () => {
      disposed = true
      apiRef.current = null
      engineIdRef.current = null
      viewportIdsRef.current = []
      ro.disconnect()
      detach.forEach(fn => fn())
      detach = []
      try {
        getRenderingEngine(engineId)?.destroy()
      } catch {
        /* déjà détruit */
      }
      try {
        cache.removeVolumeLoadObject(volumeId)
      } catch {
        /* pas en cache */
      }
    }
  }, [imageKey, capabilities, supported, apiRef, getTool, toolRef])

  return (
    <div className="absolute inset-0 flex flex-col bg-[#0B1020]" data-testid="dicom-mpr">
      <p
        className="shrink-0 border-b border-white/10 px-3 py-1.5 text-center text-[11px] text-white/55"
        data-testid="dicom-mpr-hint"
      >
        Molette : coupes dans la vue sous le curseur · Ctrl+molette : zoom · glisser : outil actif
        (fenêtrage / zoom) · fermez MPR pour revenir à la série
      </p>
      <div className="relative min-h-0 flex-1 grid grid-cols-1 gap-px bg-white/10 md:grid-cols-3">
        {PLANES.map((plane, index) => {
          const ref = index === 0 ? axialRef : index === 1 ? sagittalRef : coronalRef
          return (
            <div key={plane.id} className="relative min-h-[160px] bg-[#0B1020]">
              <div ref={ref} className="absolute inset-0" data-testid={`dicom-mpr-${plane.id}`} />
              <span className="pointer-events-none absolute left-2 top-2 text-[11px] font-medium text-white/80">
                {plane.label}
              </span>
            </div>
          )
        })}
        {!supported || message ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0B1020]/80 p-6 text-center">
            <div>
              <p className="text-sm text-white/85" data-testid="dicom-mpr-unavailable">
                {message ?? MPR_UNAVAILABLE}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 rounded-lg bg-white/10 px-3 py-2 text-xs text-white"
              >
                Revenir aux coupes
              </button>
            </div>
          </div>
        ) : null}
        {ready ? <span className="sr-only" data-testid="dicom-mpr-ready" /> : null}
      </div>
    </div>
  )
}
