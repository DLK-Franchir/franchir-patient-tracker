/**
 * Géométrie monde (mm) pour mesures et lignes de référence (U2).
 * Pur : aucun import Cornerstone, testable sans WebGL.
 */

export type Vec3 = readonly [number, number, number]

export type Plane = {
  point: Vec3
  normal: Vec3
}

export type MeasureKind = 'length' | 'angle' | 'cobb'

export function pointsRequired(kind: MeasureKind): number {
  if (kind === 'length') return 2
  if (kind === 'angle') return 3
  return 4
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

export function norm(a: Vec3): number {
  return Math.hypot(a[0], a[1], a[2])
}

/** Distance euclidienne en mm (coordonnées patient). */
export function distanceMm(a: Vec3, b: Vec3): number {
  return norm(sub(a, b))
}

/** Angle ABC en degrés, sommet `vertex`. */
export function angleDeg(a: Vec3, vertex: Vec3, c: Vec3): number {
  const u = sub(a, vertex)
  const v = sub(c, vertex)
  const denom = norm(u) * norm(v)
  if (denom < 1e-8) return Number.NaN
  const cos = Math.min(1, Math.max(-1, dot(u, v) / denom))
  return (Math.acos(cos) * 180) / Math.PI
}

/** Angle de Cobb (aigu, 0–90°) entre deux droites. */
export function cobbDeg(a1: Vec3, a2: Vec3, b1: Vec3, b2: Vec3): number {
  const u = sub(a2, a1)
  const v = sub(b2, b1)
  const denom = norm(u) * norm(v)
  if (denom < 1e-8) return Number.NaN
  const cos = Math.min(1, Math.max(-1, Math.abs(dot(u, v)) / denom))
  return (Math.acos(cos) * 180) / Math.PI
}

export function formatMm(value: number): string {
  return `${value.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mm`
}

export function formatDeg(value: number): string {
  return `${value.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}°`
}

/** Libellé d'une mesure complète, ou null si les points manquent. */
export function formatMeasure(kind: MeasureKind, points: readonly Vec3[]): string | null {
  if (points.length < pointsRequired(kind)) return null
  if (kind === 'length') {
    const d = distanceMm(points[0]!, points[1]!)
    return Number.isFinite(d) ? formatMm(d) : null
  }
  if (kind === 'angle') {
    const a = angleDeg(points[0]!, points[1]!, points[2]!)
    return Number.isFinite(a) ? formatDeg(a) : null
  }
  const a = cobbDeg(points[0]!, points[1]!, points[2]!, points[3]!)
  return Number.isFinite(a) ? formatDeg(a) : null
}

/**
 * Plan image DICOM : position patient + orientation (rangée, colonne).
 * La normale est le produit vectoriel rangée × colonne.
 */
export function planeFromOrientation(
  imagePositionPatient: Vec3,
  imageOrientationPatient: readonly number[]
): Plane | null {
  if (imageOrientationPatient.length < 6) return null
  const row: Vec3 = [
    imageOrientationPatient[0]!,
    imageOrientationPatient[1]!,
    imageOrientationPatient[2]!,
  ]
  const col: Vec3 = [
    imageOrientationPatient[3]!,
    imageOrientationPatient[4]!,
    imageOrientationPatient[5]!,
  ]
  const normal = cross(row, col)
  if (norm(normal) < 1e-8) return null
  return { point: imagePositionPatient, normal }
}

/**
 * Segment d'intersection de deux plans, centré sur un point de la droite
 * et de longueur `2 * extentMm`. Null si les plans sont parallèles.
 */
export function planeIntersectionSegment(
  a: Plane,
  b: Plane,
  extentMm: number
): [Vec3, Vec3] | null {
  const direction = cross(a.normal, b.normal)
  const denom = dot(direction, direction)
  if (denom < 1e-8) return null
  const c1 = dot(a.normal, a.point)
  const c2 = dot(b.normal, b.point)
  const n2xd = cross(b.normal, direction)
  const dxn1 = cross(direction, a.normal)
  const point: Vec3 = [
    (c1 * n2xd[0] + c2 * dxn1[0]) / denom,
    (c1 * n2xd[1] + c2 * dxn1[1]) / denom,
    (c1 * n2xd[2] + c2 * dxn1[2]) / denom,
  ]
  const len = Math.sqrt(denom)
  const unit: Vec3 = [direction[0] / len, direction[1] / len, direction[2] / len]
  const half = Math.max(1, extentMm)
  return [
    [point[0] - unit[0] * half, point[1] - unit[1] * half, point[2] - unit[2] * half],
    [point[0] + unit[0] * half, point[1] + unit[1] * half, point[2] + unit[2] * half],
  ]
}
