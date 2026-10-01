/**
 * Repère un PDF (`%PDF` … `%%EOF`) dans des octets bruts ou un DICOM encapsulé.
 */

const PDF_HEADER = [0x25, 0x50, 0x44, 0x46] as const // %PDF
const PDF_EOF = [0x25, 0x25, 0x45, 0x4f, 0x46] as const // %%EOF

function findBytes(bytes: Uint8Array, needle: readonly number[], from = 0): number {
  const last = bytes.length - needle.length
  for (let i = from; i <= last; i += 1) {
    let ok = true
    for (let j = 0; j < needle.length; j += 1) {
      if (bytes[i + j] !== needle[j]) {
        ok = false
        break
      }
    }
    if (ok) return i
  }
  return -1
}

function findLastBytes(bytes: Uint8Array, needle: readonly number[], from: number): number {
  const last = bytes.length - needle.length
  for (let i = last; i >= from; i -= 1) {
    let ok = true
    for (let j = 0; j < needle.length; j += 1) {
      if (bytes[i + j] !== needle[j]) {
        ok = false
        break
      }
    }
    if (ok) return i
  }
  return -1
}

/** Copie le PDF embarqué, ou null si aucun en-tête `%PDF`. */
export function findPdfSlice(bytes: Uint8Array): Uint8Array | null {
  const header = findBytes(bytes, PDF_HEADER)
  if (header < 0) return null
  const eof = findLastBytes(bytes, PDF_EOF, header)
  const end = eof >= 0 ? Math.min(bytes.length, eof + PDF_EOF.length) : bytes.length
  return new Uint8Array(bytes.subarray(header, end))
}
