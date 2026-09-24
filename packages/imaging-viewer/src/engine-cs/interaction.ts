/**
 * Gestes pointeur pour le StackViewport Cornerstone (U1) — sans
 * `@cornerstonejs/tools` (son worker `computeWorker` bloque le build Turbopack
 * et la suite U1 n'a besoin que de fenêtrage / zoom / pan / coupes).
 *
 * Souris : bouton gauche = outil actif (`DicomTool`), molette = coupes (host),
 * bouton droit ou Ctrl+glisser = zoom, bouton milieu ou Maj+glisser = pan.
 * Tactile : 1 doigt = outil actif, 2 doigts = pincement (zoom) + déplacement.
 */

import { utilities as csUtils, type Types as CsTypes } from '@cornerstonejs/core'
import type { DicomTool } from '../contract'

type Viewport = CsTypes.IStackViewport

export type CsInteractionOptions = {
  element: HTMLElement
  getViewport: () => Viewport | null
  getTool: () => DicomTool
  /** Défilement de coupes (outil « Coupes » tactile : glisser vertical). */
  onNavigateSlices: (delta: number) => void
  /** Déclenché après chaque modification W/L à la souris (overlay). */
  onWindowLevelChanged?: () => void
}

type Gesture = 'wl' | 'pan' | 'zoom' | 'scroll'

type PointerState = { x: number; y: number }

/** Pixels de glisser vertical par coupe (outil « Coupes »). */
export const SCROLL_DRAG_PX_PER_SLICE = 12
/** Sensibilité fenêtrage : fraction de la largeur courante par pixel. */
export const WL_DRAG_FRACTION_PER_PX = 1 / 256
export const ZOOM_MIN = 0.1
export const ZOOM_MAX = 20

export function gestureForPointer(
  event: { button: number; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean },
  tool: DicomTool
): Gesture | null {
  if (event.button === 2 || event.ctrlKey || event.metaKey) return 'zoom'
  if (event.button === 1 || event.shiftKey) return 'pan'
  if (event.button !== 0) return null
  if (tool === 'ZoomAndPan') return 'pan'
  if (tool === 'Scroll') return 'scroll'
  return 'wl'
}

export function nextWindowLevel(
  start: { center: number; width: number },
  dx: number,
  dy: number
): { center: number; width: number } {
  const sensitivity = Math.max(1, Math.abs(start.width)) * WL_DRAG_FRACTION_PER_PX
  return {
    width: Math.max(1, start.width + dx * sensitivity),
    center: start.center + dy * sensitivity,
  }
}

export function clampZoom(value: number): number {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, value))
}

function readWl(viewport: Viewport): { center: number; width: number } | null {
  try {
    const range = viewport.getProperties().voiRange
    if (!range) return null
    const wl = csUtils.windowLevel.toWindowLevel(range.lower, range.upper)
    return { center: wl.windowCenter, width: wl.windowWidth }
  } catch {
    return null
  }
}

function applyWl(viewport: Viewport, wl: { center: number; width: number }) {
  try {
    viewport.setProperties({ voiRange: csUtils.windowLevel.toLowHighRange(wl.width, wl.center) })
    viewport.render()
  } catch {
    /* image couleur / viewport détruit */
  }
}

export function attachCsInteractions(options: CsInteractionOptions): () => void {
  const { element, getViewport, getTool, onNavigateSlices, onWindowLevelChanged } = options

  const pointers = new Map<number, PointerState>()
  let gesture: Gesture | null = null
  let startX = 0
  let startY = 0
  let startWl: { center: number; width: number } | null = null
  let startPan: [number, number] = [0, 0]
  let startZoom = 1
  let scrollAccum = 0
  let pinchStartDistance = 0
  let pinchStartZoom = 1
  let pinchStartPan: [number, number] = [0, 0]
  let pinchStartMid: PointerState = { x: 0, y: 0 }

  const twoPointers = (): [PointerState, PointerState] | null => {
    if (pointers.size < 2) return null
    const [a, b] = Array.from(pointers.values())
    return a && b ? [a, b] : null
  }

  const beginSingle = (event: PointerEvent) => {
    const viewport = getViewport()
    if (!viewport) return
    gesture = gestureForPointer(event, getTool())
    if (!gesture) return
    startX = event.clientX
    startY = event.clientY
    scrollAccum = 0
    startWl = readWl(viewport)
    try {
      startPan = viewport.getPan() as [number, number]
      startZoom = viewport.getZoom()
    } catch {
      startPan = [0, 0]
      startZoom = 1
    }
  }

  const beginPinch = () => {
    const viewport = getViewport()
    const pair = twoPointers()
    if (!viewport || !pair) return
    gesture = null
    const [a, b] = pair
    pinchStartDistance = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y))
    pinchStartMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    try {
      pinchStartZoom = viewport.getZoom()
      pinchStartPan = viewport.getPan() as [number, number]
    } catch {
      pinchStartZoom = 1
      pinchStartPan = [0, 0]
    }
  }

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button > 2) return
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    try {
      element.setPointerCapture(event.pointerId)
    } catch {
      /* capture non supportée */
    }
    if (pointers.size >= 2) beginPinch()
    else beginSingle(event)
    event.preventDefault()
  }

  const onPointerMove = (event: PointerEvent) => {
    if (!pointers.has(event.pointerId)) return
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const viewport = getViewport()
    if (!viewport) return

    const pair = twoPointers()
    if (pair) {
      const [a, b] = pair
      const distance = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y))
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      try {
        viewport.setZoom(clampZoom(pinchStartZoom * (distance / pinchStartDistance)))
        viewport.setPan([
          pinchStartPan[0] + (mid.x - pinchStartMid.x),
          pinchStartPan[1] + (mid.y - pinchStartMid.y),
        ])
        viewport.render()
      } catch {
        /* viewport détruit */
      }
      return
    }

    if (!gesture) return
    const dx = event.clientX - startX
    const dy = event.clientY - startY

    if (gesture === 'wl') {
      if (!startWl) return
      applyWl(viewport, nextWindowLevel(startWl, dx, dy))
      onWindowLevelChanged?.()
    } else if (gesture === 'pan') {
      try {
        viewport.setPan([startPan[0] + dx, startPan[1] + dy])
        viewport.render()
      } catch {
        /* viewport détruit */
      }
    } else if (gesture === 'zoom') {
      try {
        viewport.setZoom(clampZoom(startZoom * Math.exp(-dy / 200)))
        viewport.render()
      } catch {
        /* viewport détruit */
      }
    } else if (gesture === 'scroll') {
      const total = dy - scrollAccum
      const steps = Math.trunc(total / SCROLL_DRAG_PX_PER_SLICE)
      if (steps !== 0) {
        scrollAccum += steps * SCROLL_DRAG_PX_PER_SLICE
        onNavigateSlices(steps)
      }
    }
  }

  const onPointerUp = (event: PointerEvent) => {
    pointers.delete(event.pointerId)
    try {
      element.releasePointerCapture(event.pointerId)
    } catch {
      /* déjà relâché */
    }
    if (pointers.size === 1) {
      // Fin de pincement : repartir d'un geste simple depuis le doigt restant.
      const remaining = Array.from(pointers.values())[0]!
      gesture = null
      startX = remaining.x
      startY = remaining.y
      beginSingle({
        button: 0,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        clientX: remaining.x,
        clientY: remaining.y,
      } as PointerEvent)
    } else if (pointers.size === 0) {
      gesture = null
    }
  }

  const onContextMenu = (event: Event) => event.preventDefault()

  element.addEventListener('pointerdown', onPointerDown)
  element.addEventListener('pointermove', onPointerMove)
  element.addEventListener('pointerup', onPointerUp)
  element.addEventListener('pointercancel', onPointerUp)
  element.addEventListener('contextmenu', onContextMenu)
  element.style.touchAction = 'none'

  return () => {
    element.removeEventListener('pointerdown', onPointerDown)
    element.removeEventListener('pointermove', onPointerMove)
    element.removeEventListener('pointerup', onPointerUp)
    element.removeEventListener('pointercancel', onPointerUp)
    element.removeEventListener('contextmenu', onContextMenu)
    pointers.clear()
  }
}
