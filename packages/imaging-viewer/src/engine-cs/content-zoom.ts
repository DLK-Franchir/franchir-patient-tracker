/**
 * Zoom de lecture : si l'anatomie n'occupe qu'une partie du cadre (repérage
 * avec beaucoup de noir), on l'agrandit pour remplir la vue. Une image déjà
 * pleine (série diagnostique) reste au cadrage « fit ».
 */

const BACKGROUND_FRACTION = 0.08
const MIN_USEFUL_ZOOM = 1.15
const PADDING = 0.92
const MAX_ZOOM = 4

export function contentZoomFactor(
  pixels: ArrayLike<number>,
  width: number,
  height: number,
): number {
  if (width < 8 || height < 8 || pixels.length < width * height) return 1

  const stride = Math.max(1, Math.floor(Math.sqrt((width * height) / 40_000)))
  let max = 0
  for (let y = 0; y < height; y += stride) {
    const row = y * width
    for (let x = 0; x < width; x += stride) {
      const value = pixels[row + x] ?? 0
      if (value > max) max = value
    }
  }
  if (!(max > 0)) return 1

  const threshold = max * BACKGROUND_FRACTION
  let minX = width
  let minY = height
  let maxX = 0
  let maxY = 0
  let count = 0
  for (let y = 0; y < height; y += stride) {
    const row = y * width
    for (let x = 0; x < width; x += stride) {
      if ((pixels[row + x] ?? 0) <= threshold) continue
      count += 1
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  if (count < 8) return 1

  const boxW = Math.max(1, maxX - minX + stride)
  const boxH = Math.max(1, maxY - minY + stride)
  const fill = Math.min(width / boxW, height / boxH)
  if (fill < MIN_USEFUL_ZOOM) return 1
  return Math.min(MAX_ZOOM, fill * PADDING)
}
