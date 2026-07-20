/**
 * Extraction du PDF encapsulé DICOM (0042,0011) — pur, sans React / dwv.
 * Utilisé par `@franchir/imaging-viewer/ui` (viewer DOC) et ré-exportable
 * depuis les apps pour les chemins upload / listing.
 */

const DICM = [0x44, 0x49, 0x43, 0x4d] as const

const IMPLICIT_VR_LITTLE_ENDIAN = '1.2.840.10008.1.2'
const EXPLICIT_VR_LITTLE_ENDIAN = '1.2.840.10008.1.2.1'
const EXPLICIT_VR_LONG_LENGTH = new Set(['OB', 'OW', 'OF', 'SQ', 'UT', 'UN', 'UC'])

/** SOP Class UID — Encapsulated PDF Storage. */
export const ENCAPSULATED_PDF_SOP_CLASS = '1.2.840.10008.5.1.4.1.1.104.1'

const TAG_ENCAPSULATED_DOCUMENT = 0x00110042 // (0042,0011)

function readU16LE(view: Uint8Array, offset: number): number {
  return view[offset]! | (view[offset + 1]! << 8)
}

function readU32LE(view: Uint8Array, offset: number): number {
  return (
    view[offset]! |
    (view[offset + 1]! << 8) |
    (view[offset + 2]! << 16) |
    (view[offset + 3]! << 24)
  ) >>> 0
}

function hasDicomPreamble(view: Uint8Array): boolean {
  if (view.length < 132) return false
  return (
    view[128] === DICM[0] &&
    view[129] === DICM[1] &&
    view[130] === DICM[2] &&
    view[131] === DICM[3]
  )
}

function isValidDicomVr(vr: string): boolean {
  return /^[A-Z]{2}$/.test(vr)
}

function hasLikelyRawDicomStructure(view: Uint8Array): boolean {
  if (view.length < 8) return false
  if (hasDicomPreamble(view)) return true
  const group = readU16LE(view, 0)
  if (![0x0002, 0x0008, 0x0010, 0x0020].includes(group)) return false
  const vr = String.fromCharCode(view[4]!, view[5]!)
  if (isValidDicomVr(vr)) {
    const length = readU16LE(view, 6)
    return length > 0 && length < 65534
  }
  const length = readU32LE(view, 4)
  return length > 0 && length < view.length
}

function readTag(
  view: Uint8Array,
  offset: number,
  implicit: boolean,
): { tag: number; valueOffset: number; valueLength: number; nextOffset: number } | null {
  if (offset + 8 > view.length) return null
  const group = readU16LE(view, offset)
  const element = readU16LE(view, offset + 2)
  const tag = group | (element << 16)

  if (implicit) {
    const length = readU32LE(view, offset + 4)
    const valueOffset = offset + 8
    return { tag, valueOffset, valueLength: length, nextOffset: valueOffset + length }
  }

  const vr = String.fromCharCode(view[offset + 4]!, view[offset + 5]!)
  if (EXPLICIT_VR_LONG_LENGTH.has(vr)) {
    if (offset + 12 > view.length) return null
    const length = readU32LE(view, offset + 8)
    const valueOffset = offset + 12
    return { tag, valueOffset, valueLength: length, nextOffset: valueOffset + length }
  }

  const length = readU16LE(view, offset + 6)
  const valueOffset = offset + 8
  return { tag, valueOffset, valueLength: length, nextOffset: valueOffset + length }
}

function readUidValue(view: Uint8Array, offset: number, length: number): string {
  const slice = view.subarray(offset, offset + length)
  return new TextDecoder('ascii').decode(slice).replace(/\0+$/, '').trim()
}

function isImplicitVrTransferSyntax(uid: string): boolean {
  return uid === IMPLICIT_VR_LITTLE_ENDIAN
}

/** Extrait le PDF encapsulé (0042,0011). */
export function extractEncapsulatedPdf(bytes: ArrayBuffer | Uint8Array): Uint8Array | null {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)

  let offset = 0
  let transferSyntax = EXPLICIT_VR_LITTLE_ENDIAN
  let inMeta = false

  if (hasDicomPreamble(view)) {
    offset = 132
    inMeta = true
  } else if (!hasLikelyRawDicomStructure(view)) {
    return null
  }

  const scanLimit = view.length

  while (offset + 8 <= scanLimit) {
    const implicit = inMeta ? false : isImplicitVrTransferSyntax(transferSyntax)
    const parsed = readTag(view, offset, implicit)
    if (!parsed || parsed.valueLength < 0 || parsed.nextOffset <= offset) break

    if (inMeta) {
      if ((parsed.tag & 0xffff) !== 0x0002) {
        inMeta = false
        continue
      }
      if (parsed.tag === 0x00100002) {
        transferSyntax = readUidValue(view, parsed.valueOffset, parsed.valueLength)
      }
    } else if (parsed.tag === TAG_ENCAPSULATED_DOCUMENT) {
      const slice = view.subarray(parsed.valueOffset, parsed.valueOffset + parsed.valueLength)
      if (
        slice.length >= 4 &&
        slice[0] === 0x25 &&
        slice[1] === 0x50 &&
        slice[2] === 0x44 &&
        slice[3] === 0x46
      ) {
        return slice
      }
      return slice.length > 0 ? slice : null
    }

    offset = parsed.nextOffset
  }

  return null
}

/** Télécharge un DICOM signé et retourne un blob URL `application/pdf`. */
export async function fetchEncapsulatedPdfBlobUrl(signedUrl: string): Promise<string> {
  const response = await fetch(signedUrl)
  if (!response.ok) {
    throw new Error('Impossible de telecharger le DICOM PDF encapsule')
  }
  const buffer = await response.arrayBuffer()
  const pdfBytes = extractEncapsulatedPdf(buffer)
  if (!pdfBytes || pdfBytes.length === 0) {
    throw new Error('PDF encapsule introuvable dans le DICOM')
  }
  const copy = new Uint8Array(pdfBytes.byteLength)
  copy.set(pdfBytes)
  const blob = new Blob([copy], { type: 'application/pdf' })
  return URL.createObjectURL(blob)
}

export type DicomContentKind = 'image' | 'encapsulated-pdf' | 'unknown'

export function classifyDicomContentFromHeader(info: {
  modality: string | null
  sopClassUid: string | null
  mimeType: string | null
}): DicomContentKind {
  if (info.sopClassUid === ENCAPSULATED_PDF_SOP_CLASS) return 'encapsulated-pdf'
  if (info.modality === 'DOC') return 'encapsulated-pdf'
  if (info.mimeType?.toLowerCase().includes('pdf')) return 'encapsulated-pdf'
  if (info.modality && info.modality !== 'DOC') return 'image'
  if (info.sopClassUid?.includes('1.1.7') || info.sopClassUid?.includes('1.1.2')) return 'image'
  return 'unknown'
}
