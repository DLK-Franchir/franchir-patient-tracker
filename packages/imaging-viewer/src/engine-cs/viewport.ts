/**
 * Opérations viewport Cornerstone3D (U1) — même vocabulaire que `dwv-app.ts`
 * pour que le host reste identique (invert, flip, presets, saut de coupe…).
 */

import { Enums as csEnums, utilities as csUtils, type Types as CsTypes } from '@cornerstonejs/core'
import { contentZoomFactor } from './content-zoom'
import type { CsStackHandle } from './stack'

type Viewport = CsTypes.IStackViewport

function vp(handle: CsStackHandle | null): Viewport | null {
  return handle?.viewport ?? null
}

export function csReadWindowLevel(
  handle: CsStackHandle | null
): { center: number; width: number } | null {
  const viewport = vp(handle)
  if (!viewport) return null
  try {
    const range = viewport.getProperties().voiRange
    if (!range) return null
    const wl = csUtils.windowLevel.toWindowLevel(range.lower, range.upper)
    return { center: wl.windowCenter, width: wl.windowWidth }
  } catch {
    return null
  }
}

export function csSetWindowLevel(handle: CsStackHandle | null, center: number, width: number) {
  const viewport = vp(handle)
  if (!viewport) return
  try {
    viewport.setProperties({ voiRange: csUtils.windowLevel.toLowHighRange(width, center) })
    viewport.render()
  } catch {
    /* image couleur ou viewport détruit */
  }
}

/** « Auto » : W/L DICOM (WindowCenter / Width du fichier ou min/max). */
export function csResetWindowLevel(handle: CsStackHandle | null) {
  const viewport = vp(handle)
  if (!viewport) return
  try {
    const { invert } = viewport.getProperties()
    viewport.resetProperties()
    // resetProperties remet aussi l'inversion : on la conserve (choix utilisateur).
    if (invert) viewport.setProperties({ invert: true })
    viewport.render()
  } catch {
    /* viewport détruit */
  }
}

/**
 * Cadrage de lecture : fit, interpolation lisse, zoom sur l'anatomie si le
 * cadre est surtout du noir. `setZoom(1)` après `resetCamera` = image entière.
 */
export function presentCsViewportForReading(viewport: CsTypes.IStackViewport) {
  viewport.resetCamera()
  try {
    viewport.setProperties({ interpolationType: csEnums.InterpolationType.LINEAR })
  } catch {
    /* image couleur */
  }
  try {
    const image = viewport.getImageData()
    const width = image?.dimensions?.[0]
    const height = image?.dimensions?.[1]
    const pixels = image?.scalarData
    if (width && height && pixels) {
      const factor = contentZoomFactor(pixels, width, height)
      if (factor > 1) viewport.setZoom(factor)
    }
  } catch {
    /* pixels pas encore décodés */
  }
  viewport.render()
}

export function csResetView(handle: CsStackHandle | null) {
  const viewport = vp(handle)
  if (!viewport) return
  try {
    viewport.resetCamera()
    viewport.resetProperties()
    viewport.render()
  } catch {
    /* viewport détruit */
  }
}

export function csToggleInvert(handle: CsStackHandle | null): boolean | null {
  const viewport = vp(handle)
  if (!viewport) return null
  try {
    const next = !viewport.getProperties().invert
    viewport.setProperties({ invert: next })
    viewport.render()
    return next
  } catch {
    return null
  }
}

export function csFlip(handle: CsStackHandle | null, axis: 'x' | 'y') {
  const viewport = vp(handle)
  if (!viewport) return
  try {
    const camera = viewport.getCamera()
    if (axis === 'x') viewport.setCamera({ flipHorizontal: !camera.flipHorizontal })
    else viewport.setCamera({ flipVertical: !camera.flipVertical })
    viewport.render()
  } catch {
    /* viewport détruit */
  }
}

/** Zoom relatif (+0.15 → ×1.15) — équivalent `app.zoom(step)` dwv. */
export function csZoomStep(handle: CsStackHandle | null, step: number) {
  const viewport = vp(handle)
  if (!viewport) return
  const factor = 1 + step
  try {
    const current = viewport.getZoom()
    if (Number.isFinite(current) && current > 0) {
      const next = Math.max(0.1, Math.min(20, current * factor))
      viewport.setZoom(next)
      const after = viewport.getZoom()
      if (Number.isFinite(after) && Math.abs(after - next) < 0.001) {
        viewport.render()
        return
      }
    }
  } catch {
    /* fallback parallelScale */
  }
  try {
    const camera = viewport.getCamera()
    const scale = camera?.parallelScale
    if (typeof scale === 'number' && scale > 0) {
      viewport.setCamera({ ...camera, parallelScale: scale / factor })
      viewport.render()
    }
  } catch {
    /* viewport détruit */
  }
}

export function csSliceIndex(handle: CsStackHandle | null): number {
  const viewport = vp(handle)
  if (!viewport) return 0
  try {
    return viewport.getCurrentImageIdIndex()
  } catch {
    return 0
  }
}

export function csSliceCount(handle: CsStackHandle | null): number {
  return handle?.imageIds.length ?? 0
}

/** Saut de coupe borné ; ignore les fichiers illisibles quand `skipFailed` est fourni. */
export async function csGoToSlice(
  handle: CsStackHandle | null,
  target: number,
  skipFailed?: ReadonlySet<number>
): Promise<void> {
  const viewport = vp(handle)
  if (!viewport || !handle) return
  const max = handle.imageIds.length - 1
  let index = Math.max(0, Math.min(max, Math.round(target)))
  if (skipFailed && skipFailed.has(index)) {
    const direction = index >= viewport.getCurrentImageIdIndex() ? 1 : -1
    let probe = index
    while (probe >= 0 && probe <= max && skipFailed.has(probe)) probe += direction
    if (probe >= 0 && probe <= max) index = probe
  }
  try {
    await viewport.setImageIdIndex(index)
  } catch {
    /* fichier illisible : l'événement IMAGE_LOAD_ERROR le marque */
  }
}

export function csNavigateSlice(
  handle: CsStackHandle | null,
  delta: number,
  skipFailed?: ReadonlySet<number>
): Promise<void> {
  return csGoToSlice(handle, csSliceIndex(handle) + delta, skipFailed)
}
