import { describe, expect, it } from 'vitest'
import { hasPixelSignal } from '@/lib/imaging/dicom-pixel-signal'

describe('hasPixelSignal', () => {
  it('rejette un buffer absent', () => {
    expect(hasPixelSignal(null)).toBe(false)
    expect(hasPixelSignal(undefined)).toBe(false)
  })

  it('rejette un buffer vide', () => {
    expect(hasPixelSignal(new Uint16Array(0))).toBe(false)
  })

  it('rejette un buffer uniforme (decode rate -> tout zero)', () => {
    expect(hasPixelSignal(new Uint16Array(1_000_000))).toBe(false)
  })

  it('rejette un buffer uniforme non nul (fond plat)', () => {
    expect(hasPixelSignal(new Uint8Array(50_000).fill(255))).toBe(false)
  })

  it('accepte un buffer avec variation de pixels', () => {
    const buf = new Uint16Array(1_000_000)
    // Variation espacée pour valider l'echantillonnage par stride.
    for (let i = 0; i < buf.length; i += 137) buf[i] = (i % 4096) + 1
    expect(hasPixelSignal(buf)).toBe(true)
  })

  it('accepte meme une variation minimale', () => {
    const buf = new Uint8Array(10)
    buf[9] = 1
    expect(hasPixelSignal(buf)).toBe(true)
  })
})
