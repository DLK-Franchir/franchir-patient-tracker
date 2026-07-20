/**
 * Fenêtrage (VOI LUT LINEAR) pour le rendu des pixels DICOM monochromes.
 * Utilisé par le viewer de repli JPEG 2000 (OpenJPEG).
 */

export type WindowLevel = {
  center: number
  width: number
}

/** Lit une valeur DICOM numérique (string, nombre, ou multi-valeur « a\\b »). */
export function parseDicomNumber(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined
  }
  if (Array.isArray(value)) {
    return parseDicomNumber(value[0])
  }
  if (typeof value === 'string') {
    const first = value.split('\\')[0]?.trim()
    if (!first) return undefined
    const n = Number(first)
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

/**
 * Calcule le fenêtrage initial à appliquer.
 * Priorité WindowCenter/WindowWidth DICOM ; sinon pleine échelle min/max pixels.
 */
export function resolveInitialWindowLevel(input: {
  windowCenter?: unknown
  windowWidth?: unknown
  pixelMin: number
  pixelMax: number
}): WindowLevel {
  const center = parseDicomNumber(input.windowCenter)
  const width = parseDicomNumber(input.windowWidth)

  if (typeof center === 'number' && typeof width === 'number' && width >= 1) {
    return { center, width }
  }

  return autoWindowLevel(input.pixelMin, input.pixelMax)
}

/** Fenêtrage couvrant tout l'intervalle min/max des pixels. */
export function autoWindowLevel(pixelMin: number, pixelMax: number): WindowLevel {
  const lo = Math.min(pixelMin, pixelMax)
  const hi = Math.max(pixelMin, pixelMax)
  const width = Math.max(1, hi - lo)
  const center = lo + width / 2
  return { center, width }
}

/**
 * VOI LUT LINEAR (PS3.3 C.11.2.1.2) — formule alignée dwv.
 */
export function windowValueToGray(value: number, wl: WindowLevel): number {
  const width = Math.max(1, wl.width)
  const c = wl.center - 0.5
  const w = width - 1
  const lower = c - w / 2
  const upper = c + w / 2
  if (value <= lower) return 0
  if (value > upper) return 255
  return Math.round(((value - c) / w + 0.5) * 255)
}

/**
 * Construit un tableau RGBA 8 bits à partir des pixels monochromes décodés.
 * @param invert true pour MONOCHROME1 (0 = blanc).
 */
export function grayPixelsToRgba(
  pixels: { length: number; [index: number]: number },
  wl: WindowLevel,
  invert = false,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(pixels.length * 4)
  for (let i = 0; i < pixels.length; i++) {
    let g = windowValueToGray(pixels[i]!, wl)
    if (invert) g = 255 - g
    const o = i * 4
    out[o] = g
    out[o + 1] = g
    out[o + 2] = g
    out[o + 3] = 255
  }
  return out
}

/** min/max d'un buffer de pixels (typed array). */
export function pixelRange(pixels: {
  length: number
  [index: number]: number
}): { min: number; max: number } {
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < pixels.length; i++) {
    const v = pixels[i]!
    if (v < min) min = v
    if (v > max) max = v
  }
  if (!Number.isFinite(min)) {
    return { min: 0, max: 0 }
  }
  return { min, max }
}
