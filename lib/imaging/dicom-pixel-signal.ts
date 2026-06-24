/**
 * Détection « pixels réellement décodés » pour le viewer DICOM.
 *
 * Quand le worker de décodage (JPEG 2000, JPEG-LS…) ne se charge pas ou échoue,
 * dwv construit malgré tout la géométrie depuis l'en-tête (Rows/Columns) mais
 * laisse un buffer de pixels vide / uniforme à zéro. Le viewer se croyait alors
 * « prêt » et affichait un canvas noir. Une vraie radiographie est toujours non
 * uniforme : on exige donc au moins deux valeurs distinctes dans un échantillon.
 */

type PixelBuffer =
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array

const MAX_SAMPLES = 2048

export function hasPixelSignal(buffer: PixelBuffer | null | undefined): boolean {
  if (!buffer) return false
  const length = buffer.length
  if (length === 0) return false
  const stride = Math.max(1, Math.floor(length / MAX_SAMPLES))
  const first = buffer[0]!
  for (let i = stride; i < length; i += stride) {
    if (buffer[i] !== first) return true
  }
  return false
}
