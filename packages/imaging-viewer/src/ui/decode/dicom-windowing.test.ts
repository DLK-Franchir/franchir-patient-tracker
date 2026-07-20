import { describe, expect, it } from 'vitest'
import {
  autoWindowLevel,
  grayPixelsToRgba,
  parseDicomNumber,
  pixelRange,
  resolveInitialWindowLevel,
  windowValueToGray,
} from './dicom-windowing'

describe('parseDicomNumber', () => {
  it('lit nombre, string et multi-valeur', () => {
    expect(parseDicomNumber(42)).toBe(42)
    expect(parseDicomNumber('32767')).toBe(32767)
    expect(parseDicomNumber('31212\\200')).toBe(31212)
    expect(parseDicomNumber('  500 ')).toBe(500)
  })
  it('renvoie undefined pour valeurs invalides', () => {
    expect(parseDicomNumber(undefined)).toBeUndefined()
    expect(parseDicomNumber('')).toBeUndefined()
    expect(parseDicomNumber('abc')).toBeUndefined()
    expect(parseDicomNumber(NaN)).toBeUndefined()
  })
})

describe('resolveInitialWindowLevel', () => {
  it('utilise le WindowCenter/Width du DICOM quand présents', () => {
    const wl = resolveInitialWindowLevel({
      windowCenter: '32767',
      windowWidth: '65535',
      pixelMin: 0,
      pixelMax: 65535,
    })
    expect(wl).toEqual({ center: 32767, width: 65535 })
  })

  it('calcule un fenêtrage auto quand W/C absent', () => {
    const wl = resolveInitialWindowLevel({
      windowCenter: undefined,
      windowWidth: undefined,
      pixelMin: 100,
      pixelMax: 4000,
    })
    expect(wl.center).toBe(100 + (4000 - 100) / 2)
    expect(wl.width).toBe(3900)
  })

  it('ignore une largeur DICOM nulle et bascule en auto', () => {
    const wl = resolveInitialWindowLevel({
      windowCenter: '0',
      windowWidth: '0',
      pixelMin: 10,
      pixelMax: 500,
    })
    expect(wl).toEqual(autoWindowLevel(10, 500))
  })
})

describe('windowValueToGray', () => {
  it('mappe le centre du fenêtrage vers un gris median', () => {
    const wl = { center: 32767, width: 65535 }
    const g = windowValueToGray(32767, wl)
    expect(g).toBeGreaterThanOrEqual(127)
    expect(g).toBeLessThanOrEqual(129)
  })

  it('clippe sous le seuil bas vers 0 et au-dessus vers 255', () => {
    const wl = { center: 1000, width: 200 }
    expect(windowValueToGray(0, wl)).toBe(0)
    expect(windowValueToGray(5000, wl)).toBe(255)
  })

  it('rend visible une donnée pleine échelle 16 bits (cas Husain DX)', () => {
    const wl = { center: 32767, width: 65535 }
    const g = windowValueToGray(19580, wl)
    expect(g).toBeGreaterThan(40)
    expect(g).toBeLessThan(110)
  })
})

describe('grayPixelsToRgba', () => {
  it('produit un buffer RGBA opaque', () => {
    const px = new Uint16Array([0, 32767, 65535])
    const rgba = grayPixelsToRgba(px, { center: 32767, width: 65535 })
    expect(rgba.length).toBe(12)
    expect(rgba[3]).toBe(255)
    expect(rgba[0]).toBe(0)
    expect(rgba[8]).toBe(255)
  })

  it('inverse pour MONOCHROME1', () => {
    const px = new Uint16Array([0])
    const normal = grayPixelsToRgba(px, { center: 32767, width: 65535 }, false)
    const inverted = grayPixelsToRgba(px, { center: 32767, width: 65535 }, true)
    expect(normal[0]).toBe(0)
    expect(inverted[0]).toBe(255)
  })
})

describe('pixelRange', () => {
  it('calcule min/max', () => {
    expect(pixelRange(new Uint16Array([5, 1, 9, 3]))).toEqual({ min: 1, max: 9 })
  })
  it('gère un buffer vide', () => {
    expect(pixelRange(new Uint16Array([]))).toEqual({ min: 0, max: 0 })
  })
})
