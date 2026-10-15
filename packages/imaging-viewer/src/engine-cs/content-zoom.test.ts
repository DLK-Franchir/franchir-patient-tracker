import { describe, expect, it } from 'vitest'
import { contentZoomFactor } from './content-zoom'

function fill(width: number, height: number, value: number): Float32Array {
  return new Float32Array(width * height).fill(value)
}

describe('contentZoomFactor', () => {
  it('laisse une image déjà pleine au cadrage fit', () => {
    expect(contentZoomFactor(fill(64, 64, 400), 64, 64)).toBe(1)
  })

  it('agrandit un ilot clair au milieu du noir', () => {
    const width = 100
    const height = 100
    const pixels = fill(width, height, 0)
    for (let y = 40; y < 60; y += 1) {
      for (let x = 40; x < 60; x += 1) pixels[y * width + x] = 800
    }
    const zoom = contentZoomFactor(pixels, width, height)
    expect(zoom).toBeGreaterThan(2)
    expect(zoom).toBeLessThanOrEqual(4)
  })

  it('ignore un buffer vide', () => {
    expect(contentZoomFactor(fill(32, 32, 0), 32, 32)).toBe(1)
    expect(contentZoomFactor(new Float32Array(4), 32, 32)).toBe(1)
  })
})
