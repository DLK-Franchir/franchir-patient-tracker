import { describe, expect, it } from 'vitest'
import {
  classifyDicomContentFromHeader,
  ENCAPSULATED_PDF_SOP_CLASS,
  extractEncapsulatedPdf,
} from './encapsulated-pdf'

function appendExplicitTag(
  chunks: number[],
  group: number,
  element: number,
  vr: string,
  value: Uint8Array | string,
): void {
  chunks.push(group & 0xff, (group >> 8) & 0xff)
  chunks.push(element & 0xff, (element >> 8) & 0xff)
  chunks.push(vr.charCodeAt(0)!, vr.charCodeAt(1)!)
  const valueBytes = typeof value === 'string' ? new TextEncoder().encode(value) : value
  const longVr = new Set(['OB', 'OW', 'OF', 'SQ', 'UT', 'UN', 'UC'])
  if (longVr.has(vr)) {
    chunks.push(0, 0)
    let len = valueBytes.length
    if (len % 2 !== 0) len += 1
    chunks.push(len & 0xff, (len >> 8) & 0xff, (len >> 16) & 0xff, (len >> 24) & 0xff)
    for (const b of valueBytes) chunks.push(b)
    if (valueBytes.length % 2 !== 0) chunks.push(0)
    return
  }
  let len = valueBytes.length
  if (len % 2 !== 0) len += 1
  chunks.push(len & 0xff, (len >> 8) & 0xff)
  for (const b of valueBytes) chunks.push(b)
  if (valueBytes.length % 2 !== 0) chunks.push(0)
}

function buildEncapsulatedPdfDicom(pdfAscii: string): Uint8Array {
  const chunks: number[] = new Array(128).fill(0)
  chunks.push(0x44, 0x49, 0x43, 0x4d)
  appendExplicitTag(chunks, 0x0002, 0x0010, 'UI', '1.2.840.10008.1.2.1')
  appendExplicitTag(chunks, 0x0008, 0x0016, 'UI', ENCAPSULATED_PDF_SOP_CLASS)
  appendExplicitTag(chunks, 0x0008, 0x0060, 'CS', 'DOC')
  appendExplicitTag(chunks, 0x0042, 0x0010, 'LO', 'application/pdf')
  appendExplicitTag(chunks, 0x0042, 0x0011, 'OB', new TextEncoder().encode(pdfAscii))
  return new Uint8Array(chunks)
}

describe('extractEncapsulatedPdf', () => {
  it('extrait le flux PDF (0042,0011)', () => {
    const pdf = '%PDF-1.4 fake content'
    const bytes = buildEncapsulatedPdfDicom(pdf)
    const extracted = extractEncapsulatedPdf(bytes)
    expect(extracted).not.toBeNull()
    expect(new TextDecoder('ascii').decode(extracted!).replace(/\0+$/, '')).toContain('%PDF-1.4')
  })

  it('retourne null hors DICOM', () => {
    expect(extractEncapsulatedPdf(new Uint8Array([1, 2, 3, 4]))).toBeNull()
  })
})

describe('classifyDicomContentFromHeader', () => {
  it('classe SOP Encapsulated PDF / modality DOC', () => {
    expect(
      classifyDicomContentFromHeader({
        sopClassUid: ENCAPSULATED_PDF_SOP_CLASS,
        modality: null,
        mimeType: null,
      }),
    ).toBe('encapsulated-pdf')
    expect(
      classifyDicomContentFromHeader({
        sopClassUid: null,
        modality: 'DOC',
        mimeType: null,
      }),
    ).toBe('encapsulated-pdf')
  })

  it('classe image pour modality MR', () => {
    expect(
      classifyDicomContentFromHeader({
        sopClassUid: null,
        modality: 'MR',
        mimeType: null,
      }),
    ).toBe('image')
  })
})
