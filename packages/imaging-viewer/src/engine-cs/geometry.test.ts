import { describe, expect, it } from 'vitest'
import {
  angleDeg,
  cobbDeg,
  distanceMm,
  formatMeasure,
  planeFromOrientation,
  planeIntersectionSegment,
  pointsRequired,
} from './geometry'

describe('mesures U2', () => {
  it('compte les points attendus', () => {
    expect(pointsRequired('length')).toBe(2)
    expect(pointsRequired('angle')).toBe(3)
    expect(pointsRequired('cobb')).toBe(4)
  })

  it('distance 3-4-5', () => {
    expect(distanceMm([0, 0, 0], [3, 4, 0])).toBeCloseTo(5)
  })

  it('angle droit au sommet', () => {
    expect(angleDeg([1, 0, 0], [0, 0, 0], [0, 1, 0])).toBeCloseTo(90)
  })

  it('Cobb aigu de 30°', () => {
    const cos = Math.cos(Math.PI / 6)
    const sin = Math.sin(Math.PI / 6)
    expect(cobbDeg([0, 0, 0], [1, 0, 0], [0, 0, 0], [cos, sin, 0])).toBeCloseTo(30)
  })

  it('formate en français', () => {
    expect(
      formatMeasure('length', [
        [0, 0, 0],
        [3, 4, 0],
      ])
    ).toBe('5,0 mm')
    expect(
      formatMeasure('angle', [
        [1, 0, 0],
        [0, 0, 0],
        [0, 1, 0],
      ])
    ).toBe('90°')
    expect(formatMeasure('length', [[0, 0, 0]])).toBeNull()
  })
})

describe('intersection de plans (lignes de référence)', () => {
  const axial = planeFromOrientation([0, 0, 10], [1, 0, 0, 0, 1, 0])
  const sagittal = planeFromOrientation([5, 0, 0], [0, 1, 0, 0, 0, -1])

  it('refuse une orientation incomplète', () => {
    expect(planeFromOrientation([0, 0, 0], [1, 0, 0])).toBeNull()
  })

  it('renvoie un segment le long de l’intersection', () => {
    expect(axial).not.toBeNull()
    expect(sagittal).not.toBeNull()
    const segment = planeIntersectionSegment(axial!, sagittal!, 100)
    expect(segment).not.toBeNull()
    const [p, q] = segment!
    // Plans z=10 et x=5 : la droite est x=5, z=10, y libre.
    expect(p[0]).toBeCloseTo(5)
    expect(q[0]).toBeCloseTo(5)
    expect(p[2]).toBeCloseTo(10)
    expect(q[2]).toBeCloseTo(10)
    expect(Math.abs(p[1] - q[1])).toBeCloseTo(200)
  })

  it('plans parallèles : pas de droite', () => {
    const other = planeFromOrientation([0, 0, 20], [1, 0, 0, 0, 1, 0])
    expect(planeIntersectionSegment(axial!, other!, 100)).toBeNull()
  })
})
