/**
 * Octets PDF d'un fichier patient : PDF nu ou document encapsulé DICOM (0042,0011).
 * dicom-parser gère les longueurs explicites / indéfinies que le parseur maison ratait.
 */

import dicomParser from 'dicom-parser'
import { findPdfSlice } from '@/lib/documents/pdf-bytes'

export function readReportPdfBytes(
  fileBytes: Uint8Array,
  hint?: { kind?: string | null; fileName?: string | null; mimeType?: string | null },
): Uint8Array | null {
  const name = (hint?.fileName ?? '').toLowerCase()
  const mime = (hint?.mimeType ?? '').toLowerCase()
  const looksPdf = mime === 'application/pdf' || name.endsWith('.pdf')

  if (looksPdf) {
    return findPdfSlice(fileBytes)
  }

  try {
    const dataSet = dicomParser.parseDicom(fileBytes)
    const element = dataSet.elements.x00420011
    if (element && element.length > 8 && element.dataOffset + element.length <= fileBytes.length) {
      const raw = fileBytes.subarray(element.dataOffset, element.dataOffset + element.length)
      const pdf = findPdfSlice(raw)
      if (pdf && pdf.byteLength > 8) return pdf
    }
  } catch {
    // Pas un DICOM Part 10 lisible — on tente quand même un %PDF embarqué.
  }

  if (hint?.kind === 'dicom' || !looksPdf) {
    return findPdfSlice(fileBytes)
  }
  return null
}

/** Plusieurs découpes possibles : tag DICOM, puis %PDF dans le fichier entier. */
export function reportPdfAttempts(
  fileBytes: Uint8Array,
  hint?: { kind?: string | null; fileName?: string | null; mimeType?: string | null },
): Uint8Array[] {
  const out: Uint8Array[] = []
  const seen = new Set<string>()
  const push = (bytes: Uint8Array | null) => {
    if (!bytes || bytes.byteLength < 16) return
    const key = `${bytes.byteLength}:${bytes[0]}:${bytes[5] ?? 0}:${bytes[bytes.byteLength - 1]}`
    if (seen.has(key)) return
    seen.add(key)
    out.push(bytes)
  }
  push(readReportPdfBytes(fileBytes, hint))
  const name = (hint?.fileName ?? '').toLowerCase()
  const mime = (hint?.mimeType ?? '').toLowerCase()
  const looksPdf = mime === 'application/pdf' || name.endsWith('.pdf')
  if (!looksPdf) push(findPdfSlice(fileBytes))
  return out
}
