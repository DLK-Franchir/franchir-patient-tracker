/**
 * Classification DICOM (image vs PDF encapsulé) et extraction du flux PDF.
 */

import {
  DICOM_HEADER_SCAN_BYTES,
  hasDicomPreamble,
  hasLikelyRawDicomStructure,
  type DicomHeaderInfo,
} from '@/lib/imaging/dicom-detection'

export type DicomContentKind = 'image' | 'encapsulated-pdf' | 'unknown'

/** SOP Class UID — Encapsulated PDF Storage. */
export const ENCAPSULATED_PDF_SOP_CLASS = '1.2.840.10008.5.1.4.1.1.104.1'

/** Médiane typique des DOC encapsulés sur CD DICOMS_IM (Fatima Husain). */
export const ENCAPSULATED_PDF_BAND_MAX_BYTES = 120_000

const TAG_SOP_CLASS_UID = 0x00160008
const TAG_MODALITY = 0x00600008
const TAG_MIME_TYPE = 0x00120042
const TAG_ENCAPSULATED_DOCUMENT = 0x00110042

const IMPLICIT_VR_LITTLE_ENDIAN = '1.2.840.10008.1.2'
const EXPLICIT_VR_LITTLE_ENDIAN = '1.2.840.10008.1.2.1'

const EXPLICIT_VR_LONG_LENGTH = new Set(['OB', 'OW', 'OF', 'SQ', 'UT', 'UN', 'UC'])

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

function readStringValue(view: Uint8Array, offset: number, length: number): string {
  const slice = view.subarray(offset, offset + length)
  return new TextDecoder('ascii').decode(slice).replace(/\0+$/, '').trim()
}

function isImplicitVrTransferSyntax(uid: string): boolean {
  return uid === IMPLICIT_VR_LITTLE_ENDIAN
}

export type DicomContentInfo = DicomHeaderInfo & {
  sopClassUid: string | null
  mimeType: string | null
  contentKind: DicomContentKind
}

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

/** Heuristique listing (sans octets) : lot DOC encapsulé sur CD DICOMS_IM. */
export function isLikelyEncapsulatedPdfBand(files: Array<{ size?: number | null }>): boolean {
  const sizes = files
    .map((file) => file.size)
    .filter((size): size is number => typeof size === 'number' && size > 0)
  if (sizes.length === 0) return false
  const sorted = [...sizes].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0
  return median > 0 && median <= ENCAPSULATED_PDF_BAND_MAX_BYTES
}

export function parseDicomContentInfo(bytes: ArrayBuffer | Uint8Array): DicomContentInfo | null {
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

  const info: DicomContentInfo = {
    seriesInstanceUid: '',
    modality: null,
    sopInstanceUid: null,
    sopClassUid: null,
    mimeType: null,
    contentKind: 'unknown',
  }

  const scanLimit = Math.min(view.length, DICOM_HEADER_SCAN_BYTES)

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
    } else {
      if (parsed.tag === 0x000e0020) {
        info.seriesInstanceUid = readUidValue(view, parsed.valueOffset, parsed.valueLength)
      } else if (parsed.tag === TAG_MODALITY) {
        info.modality = readStringValue(view, parsed.valueOffset, parsed.valueLength) || null
      } else if (parsed.tag === 0x00180008) {
        info.sopInstanceUid = readUidValue(view, parsed.valueOffset, parsed.valueLength)
      } else if (parsed.tag === TAG_SOP_CLASS_UID) {
        info.sopClassUid = readUidValue(view, parsed.valueOffset, parsed.valueLength)
      } else if (parsed.tag === TAG_MIME_TYPE) {
        info.mimeType = readStringValue(view, parsed.valueOffset, parsed.valueLength) || null
      }
    }

    offset = parsed.nextOffset
  }

  info.contentKind = classifyDicomContentFromHeader(info)
  return info
}

/** Extrait le PDF encapsulé (0042,0011). Pour les petits DOC le scan couvre tout le fichier. */
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
      if (slice.length >= 4 && slice[0] === 0x25 && slice[1] === 0x50 && slice[2] === 0x44 && slice[3] === 0x46) {
        return slice
      }
      return slice.length > 0 ? slice : null
    }

    offset = parsed.nextOffset
  }

  return null
}

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
