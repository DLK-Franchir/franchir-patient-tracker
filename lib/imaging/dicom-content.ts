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

// Tags encodés `group | (element << 16)` (cf. readTag).
const TAG_SOP_INSTANCE_UID = 0x00180008 // (0008,0018)
const TAG_SERIES_INSTANCE_UID = 0x000e0020 // (0020,000E)
const TAG_SERIES_DESCRIPTION = 0x103e0008 // (0008,103E)
const TAG_BODY_PART_EXAMINED = 0x00150018 // (0018,0015)
const TAG_PROTOCOL_NAME = 0x10300018 // (0018,1030)
const TAG_INSTANCE_NUMBER = 0x00130020 // (0020,0013)
const TAG_ACQUISITION_DATETIME = 0x002a0008 // (0008,002A)
const TAG_ACQUISITION_DATE = 0x00220008 // (0008,0022)
const TAG_ACQUISITION_TIME = 0x00320008 // (0008,0032)
const TAG_SERIES_DATE = 0x00210008 // (0008,0021)
const TAG_STUDY_DATE = 0x00200008 // (0008,0020)

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

const UNDEFINED_LENGTH = 0xffffffff

/**
 * Fin (offset après) d'un data element, en gérant les séquences à longueur
 * indéfinie (FFFE,E0DD) et leurs items imbriqués.
 */
function endOfDataElement(view: Uint8Array, pos: number, implicit: boolean): number {
  if (pos + 8 > view.length) return view.length
  if (implicit) {
    const length = readU32LE(view, pos + 4)
    const valueOffset = pos + 8
    if (length === UNDEFINED_LENGTH) return skipUndefinedSequence(view, valueOffset, implicit)
    return valueOffset + length
  }
  const vr = String.fromCharCode(view[pos + 4]!, view[pos + 5]!)
  if (EXPLICIT_VR_LONG_LENGTH.has(vr)) {
    const length = readU32LE(view, pos + 8)
    const valueOffset = pos + 12
    if (length === UNDEFINED_LENGTH) return skipUndefinedSequence(view, valueOffset, implicit)
    return valueOffset + length
  }
  const length = readU16LE(view, pos + 6)
  return pos + 8 + length
}

/** Saute un item à longueur indéfinie ; pos = début de son contenu. */
function skipUndefinedItem(view: Uint8Array, pos: number, implicit: boolean): number {
  while (pos + 8 <= view.length) {
    const group = readU16LE(view, pos)
    const element = readU16LE(view, pos + 2)
    if (group === 0xfffe && element === 0xe00d) return pos + 8 // fin d'item
    const next = endOfDataElement(view, pos, implicit)
    if (next <= pos) return view.length
    pos = next
  }
  return view.length
}

/** Saute une séquence à longueur indéfinie ; pos = début du 1er item. */
function skipUndefinedSequence(view: Uint8Array, pos: number, implicit: boolean): number {
  while (pos + 8 <= view.length) {
    const group = readU16LE(view, pos)
    const element = readU16LE(view, pos + 2)
    const length = readU32LE(view, pos + 4)
    pos += 8
    if (group === 0xfffe && element === 0xe0dd) return pos // fin de séquence
    if (group === 0xfffe && element === 0xe000) {
      pos = length === UNDEFINED_LENGTH ? skipUndefinedItem(view, pos, implicit) : pos + length
    } else {
      return pos // structure inattendue : on s'arrête proprement
    }
  }
  return view.length
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
  /** SeriesDescription (0008,103E). */
  seriesDescription: string | null
  /** BodyPartExamined (0018,0015). */
  bodyPart: string | null
  /** ProtocolName (0018,1030). */
  protocolName: string | null
  /** InstanceNumber (0020,0013), parsé en entier. */
  instanceNumber: number | null
  /** AcquisitionDateTime brut (0008,002A). */
  acquisitionDateTime: string | null
  /** AcquisitionDate (0008,0022). */
  acquisitionDate: string | null
  /** AcquisitionTime (0008,0032). */
  acquisitionTime: string | null
  /** SeriesDate (0008,0021). */
  seriesDate: string | null
  /** StudyDate (0008,0020). */
  studyDate: string | null
}

/**
 * Métadonnées DICOM persistées dans patient_documents (grouping/dedup côté
 * serveur, sans relire les octets à chaque affichage).
 */
export type DicomPersistedMetadata = {
  sopInstanceUid: string | null
  seriesInstanceUid: string | null
  seriesDescription: string | null
  bodyPart: string | null
  instanceNumber: number | null
  /** Horodatage d'acquisition normalisé triable (YYYYMMDDHHMMSS), ou null. */
  acquisitionDatetime: string | null
}

/** Garde les 14 premiers chiffres (YYYYMMDDHHMMSS) d'une valeur DICOM DA/TM/DT. */
function digitsOnly(value: string | null): string {
  return value ? value.replace(/[^0-9]/g, '') : ''
}

/**
 * Construit un horodatage d'acquisition triable depuis les différents tags
 * disponibles : AcquisitionDateTime, puis (AcquisitionDate + AcquisitionTime),
 * puis SeriesDate/StudyDate (+ AcquisitionTime). Retourne YYYYMMDDHHMMSS rempli
 * de zéros, ou null si aucune date exploitable.
 */
export function normalizeAcquisitionDateTime(info: {
  acquisitionDateTime: string | null
  acquisitionDate: string | null
  acquisitionTime: string | null
  seriesDate: string | null
  studyDate: string | null
}): string | null {
  const dt = digitsOnly(info.acquisitionDateTime)
  if (dt.length >= 8) return dt.slice(0, 14).padEnd(14, '0')

  const date = digitsOnly(info.acquisitionDate) || digitsOnly(info.seriesDate) || digitsOnly(info.studyDate)
  if (date.length < 8) return null
  const time = digitsOnly(info.acquisitionTime)
  return (date.slice(0, 8) + time.slice(0, 6)).padEnd(14, '0')
}

/** Extrait les métadonnées DICOM persistées depuis l'en-tête (octets déjà lus). */
export function extractDicomPersistedMetadata(
  bytes: ArrayBuffer | Uint8Array,
): DicomPersistedMetadata | null {
  const info = parseDicomContentInfo(bytes)
  if (!info) return null
  return {
    sopInstanceUid: info.sopInstanceUid,
    seriesInstanceUid: info.seriesInstanceUid || null,
    seriesDescription: info.seriesDescription,
    bodyPart: info.bodyPart,
    instanceNumber: info.instanceNumber,
    acquisitionDatetime: normalizeAcquisitionDateTime(info),
  }
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
    seriesDescription: null,
    bodyPart: null,
    protocolName: null,
    instanceNumber: null,
    acquisitionDateTime: null,
    acquisitionDate: null,
    acquisitionTime: null,
    seriesDate: null,
    studyDate: null,
  }

  const scanLimit = Math.min(view.length, DICOM_HEADER_SCAN_BYTES)

  while (offset + 8 <= scanLimit) {
    const implicit = inMeta ? false : isImplicitVrTransferSyntax(transferSyntax)
    const parsed = readTag(view, offset, implicit)
    if (!parsed) break

    // Séquence à longueur indéfinie (ex. 0008,1110) : on saute proprement ses
    // items au lieu de casser le scan (sinon SeriesInstanceUID/BodyPart/
    // InstanceNumber, situés après, ne sont jamais lus).
    if (!inMeta && parsed.valueLength === UNDEFINED_LENGTH) {
      const skipped = skipUndefinedSequence(view, parsed.valueOffset, implicit)
      if (skipped <= offset) break
      offset = skipped
      continue
    }

    if (parsed.valueLength < 0 || parsed.nextOffset <= offset) break

    if (inMeta) {
      if ((parsed.tag & 0xffff) !== 0x0002) {
        inMeta = false
        continue
      }
      if (parsed.tag === 0x00100002) {
        transferSyntax = readUidValue(view, parsed.valueOffset, parsed.valueLength)
      }
    } else {
      if (parsed.tag === TAG_SERIES_INSTANCE_UID) {
        info.seriesInstanceUid = readUidValue(view, parsed.valueOffset, parsed.valueLength)
      } else if (parsed.tag === TAG_MODALITY) {
        info.modality = readStringValue(view, parsed.valueOffset, parsed.valueLength) || null
      } else if (parsed.tag === TAG_SOP_INSTANCE_UID) {
        info.sopInstanceUid = readUidValue(view, parsed.valueOffset, parsed.valueLength)
      } else if (parsed.tag === TAG_SOP_CLASS_UID) {
        info.sopClassUid = readUidValue(view, parsed.valueOffset, parsed.valueLength)
      } else if (parsed.tag === TAG_MIME_TYPE) {
        info.mimeType = readStringValue(view, parsed.valueOffset, parsed.valueLength) || null
      } else if (parsed.tag === TAG_SERIES_DESCRIPTION) {
        info.seriesDescription = readStringValue(view, parsed.valueOffset, parsed.valueLength) || null
      } else if (parsed.tag === TAG_BODY_PART_EXAMINED) {
        info.bodyPart = readStringValue(view, parsed.valueOffset, parsed.valueLength) || null
      } else if (parsed.tag === TAG_PROTOCOL_NAME) {
        info.protocolName = readStringValue(view, parsed.valueOffset, parsed.valueLength) || null
      } else if (parsed.tag === TAG_INSTANCE_NUMBER) {
        const raw = readStringValue(view, parsed.valueOffset, parsed.valueLength)
        const n = Number.parseInt(raw, 10)
        info.instanceNumber = Number.isFinite(n) ? n : null
      } else if (parsed.tag === TAG_ACQUISITION_DATETIME) {
        info.acquisitionDateTime = readStringValue(view, parsed.valueOffset, parsed.valueLength) || null
      } else if (parsed.tag === TAG_ACQUISITION_DATE) {
        info.acquisitionDate = readStringValue(view, parsed.valueOffset, parsed.valueLength) || null
      } else if (parsed.tag === TAG_ACQUISITION_TIME) {
        info.acquisitionTime = readStringValue(view, parsed.valueOffset, parsed.valueLength) || null
      } else if (parsed.tag === TAG_SERIES_DATE) {
        info.seriesDate = readStringValue(view, parsed.valueOffset, parsed.valueLength) || null
      } else if (parsed.tag === TAG_STUDY_DATE) {
        info.studyDate = readStringValue(view, parsed.valueOffset, parsed.valueLength) || null
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
