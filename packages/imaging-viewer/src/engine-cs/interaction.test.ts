import { describe, expect, it } from 'vitest'
import {
  SCROLL_DRAG_PX_PER_SLICE,
  WL_DRAG_FRACTION_PER_PX,
  ZOOM_MAX,
  ZOOM_MIN,
  clampZoom,
  gestureForPointer,
  nextWindowLevel,
} from './interaction'

describe('gestureForPointer (U1)', () => {
  const none = { ctrlKey: false, metaKey: false, shiftKey: false }

  it('bouton gauche = outil actif', () => {
    expect(gestureForPointer({ button: 0, ...none }, 'WindowLevel')).toBe('wl')
    expect(gestureForPointer({ button: 0, ...none }, 'ZoomAndPan')).toBe('pan')
    expect(gestureForPointer({ button: 0, ...none }, 'Scroll')).toBe('scroll')
  })

  it('bouton droit ou Ctrl = zoom, milieu ou Maj = pan', () => {
    expect(gestureForPointer({ button: 2, ...none }, 'WindowLevel')).toBe('zoom')
    expect(gestureForPointer({ button: 0, ...none, ctrlKey: true }, 'WindowLevel')).toBe('zoom')
    expect(gestureForPointer({ button: 0, ...none, metaKey: true }, 'Scroll')).toBe('zoom')
    expect(gestureForPointer({ button: 1, ...none }, 'WindowLevel')).toBe('pan')
    expect(gestureForPointer({ button: 0, ...none, shiftKey: true }, 'WindowLevel')).toBe('pan')
  })

  it('ignore les boutons exotiques', () => {
    expect(gestureForPointer({ button: 4, ...none }, 'WindowLevel')).toBeNull()
  })
})

describe('nextWindowLevel / clampZoom (U1)', () => {
  it('glisser à droite élargit, vers le bas déplace le centre', () => {
    const start = { center: 1500, width: 3000 }
    const next = nextWindowLevel(start, 256, 0)
    expect(next.width).toBeCloseTo(start.width + start.width * WL_DRAG_FRACTION_PER_PX * 256)
    expect(next.center).toBe(start.center)
    expect(nextWindowLevel(start, 0, 256).center).toBeGreaterThan(start.center)
  })

  it('la largeur ne descend pas sous 1', () => {
    expect(nextWindowLevel({ center: 0, width: 2 }, -10000, 0).width).toBe(1)
  })

  it('borne le zoom', () => {
    expect(clampZoom(0)).toBe(ZOOM_MIN)
    expect(clampZoom(100)).toBe(ZOOM_MAX)
    expect(clampZoom(2)).toBe(2)
  })

  it('expose le pas de défilement tactile', () => {
    expect(SCROLL_DRAG_PX_PER_SLICE).toBeGreaterThan(0)
  })
})
