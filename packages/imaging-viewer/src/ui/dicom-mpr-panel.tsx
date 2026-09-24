'use client'

/**
 * MPR conditionnel (U2) — trois vues orthogonales si la série est un volume
 * homogène (même orientation, espacement, taille). Sinon un message, pas d'erreur.
 */

import { useEffect, useRef, useState } from 'react'
import {
  Enums as csEnums,
  RenderingEngine,
  getRenderingEngine,
  setVolumesForViewports,
  volumeLoader,
  cache,
} from '@cornerstonejs/core'
import type { ViewerCapabilities } from '../contract'
import { CS_VIEWPORT_BACKGROUND } from '../engine-cs/stack'
import { ensureCornerstone } from '../engine-cs/init'
import { attachCsInteractions } from '../engine-cs/interaction'
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

export function DicomMprPanel({
  imageIds,
  capabilities,
  onClose,
}: {
  imageIds: string[]
  capabilities: ViewerCapabilities
  onClose: () => void
}) {
  const axialRef = useRef<HTMLDivElement | null>(null)
  const sagittalRef = useRef<HTMLDivElement | null>(null)
  const coronalRef = useRef<HTMLDivElement | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const imageKey = imageIds.join('\n')
  const supported = seriesSupportsMpr(imageKey.split('\n').filter(Boolean))

  useEffect(() => {
    if (!supported) return
    const ids = imageKey.split('\n').filter(Boolean)
    const elements = [axialRef.current, sagittalRef.current, coronalRef.current]
    if (elements.some(el => !el)) return

    let disposed = false
    const engineId = `franchir-mpr-${Date.now()}`
    const volumeId = `cornerstoneStreamingImageVolume:${engineId}`
    const viewportIds = PLANES.map(plane => `${engineId}-${plane.id}`)
    let detach: Array<() => void> = []

    const fail = (err: unknown) => {
      if (disposed) return
      console.error('[DicomViewer/cs] MPR', mprReason(err))
      setMessage(MPR_FAILED)
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
            getTool: () => 'WindowLevel',
            onNavigateSlices: delta => {
              try {
                const viewport = engine.getViewport(viewportIds[index]!)
                if (viewport && 'scroll' in viewport) {
                  ;(viewport as { scroll: (d: number) => void }).scroll(delta)
                }
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
        if (!disposed) setReady(true)
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
  }, [imageKey, capabilities, supported])

  return (
    <div
      className="absolute inset-0 grid grid-cols-1 gap-px bg-white/10 md:grid-cols-3"
      data-testid="dicom-mpr"
    >
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
  )
}
