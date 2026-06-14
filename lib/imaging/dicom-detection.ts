/**
 * Heuristiques DICOM pour fichiers sans extension (CD médicaux, exports PACS).
 */

import { getFileExtension } from '@/lib/documents/patient-documents'

const DICM = [0x44, 0x49, 0x43, 0x4d] as const

export const DICOM_MIME_TYPE = 'application/dicom'

export const DICOM_HEADER_SCAN_BYTES = 256 * 1024

export function hasDicomPreamble(bytes: ArrayBuffer | Uint8Array): boolean {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  if (view.length < 132) return false
  return (
    view[128] === DICM[0] &&
    view[129] === DICM[1] &&
    view[130] === DICM[2] &&
    view[131] === DICM[3]
  )
}

export function ensureDicomExtension(name: string): string {
  if (getFileExtension(name) !== null) return name
  const base = name.trim()
  return base.length > 0 ? `${base}.dcm` : 'fichier.dcm'
}

export type DicomHeaderInfo = {
  seriesInstanceUid: string
  modality: string | null
  sopInstanceUid: string | null
}

const TAG_TRANSFER_SYNTAX = 0x00100002
/** (0020,000E) Series Instance UID — pas (0020,000D) Instance Number. */
const TAG_SERIES_INSTANCE_UID = 0x000e0020
const TAG_MODALITY = 0x00600008
/** (0008,0018) SOP Instance UID */
const TAG_SOP_INSTANCE_UID = 0x00180008

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

export function parseDicomHeaderInfo(bytes: ArrayBuffer | Uint8Array): DicomHeaderInfo | null {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  if (!hasDicomPreamble(view)) return null

  let offset = 132
  let transferSyntax = EXPLICIT_VR_LITTLE_ENDIAN
  let inMeta = true

  const info: DicomHeaderInfo = {
    seriesInstanceUid: '',
    modality: null,
    sopInstanceUid: null,
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
      if (parsed.tag === TAG_TRANSFER_SYNTAX) {
        transferSyntax = readUidValue(view, parsed.valueOffset, parsed.valueLength)
      }
    } else {
      if (parsed.tag === TAG_SERIES_INSTANCE_UID) {
        info.seriesInstanceUid = readUidValue(view, parsed.valueOffset, parsed.valueLength)
      } else if (parsed.tag === TAG_MODALITY) {
        info.modality = readStringValue(view, parsed.valueOffset, parsed.valueLength) || null
      } else if (parsed.tag === TAG_SOP_INSTANCE_UID) {
        info.sopInstanceUid = readUidValue(view, parsed.valueOffset, parsed.valueLength)
      }
    }

    if (info.seriesInstanceUid && info.modality && info.sopInstanceUid) break
    offset = parsed.nextOffset
  }

  if (!info.seriesInstanceUid) return null
  return info
}

export async function fileHasDicomPreamble(file: File): Promise<boolean> {
  const head = file.slice(0, Math.min(file.size, 132))
  const buffer = await head.arrayBuffer()
  return hasDicomPreamble(buffer)
}

export async function readDicomHeaderFromFile(file: File): Promise<DicomHeaderInfo | null> {
  const head = file.slice(0, Math.min(file.size, DICOM_HEADER_SCAN_BYTES))
  const buffer = await head.arrayBuffer()
  return parseDicomHeaderInfo(buffer)
}
