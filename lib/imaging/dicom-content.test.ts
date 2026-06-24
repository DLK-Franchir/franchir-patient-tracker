import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  classifyDicomContentFromHeader,
  ENCAPSULATED_PDF_SOP_CLASS,
  extractEncapsulatedPdf,
  isLikelyEncapsulatedPdfBand,
  parseDicomContentInfo,
} from '@/lib/imaging/dicom-content'

const HUSAIN_DIR = 'IMAGES_Husain/IMAGES/DICOMS'
// IMAGES_Husain = échantillons PHI, .gitignored. Les tests fixtures sont donc
// ignorés là où les fichiers sont absents (CI, autre machine).
const hasHusainSamples = existsSync(`${HUSAIN_DIR}/IM1`) && existsSync(`${HUSAIN_DIR}/IM2`)

describe.skipIf(!hasHusainSamples)('dicom-content (fixtures PHI Husain)', () => {
  it('detecte IM1 Husain comme PDF encapsule', () => {
    const buf = readFileSync(`${HUSAIN_DIR}/IM1`)
    const info = parseDicomContentInfo(buf)
    expect(info?.modality).toBe('DOC')
    expect(info?.contentKind).toBe('encapsulated-pdf')
    const pdf = extractEncapsulatedPdf(buf)
    expect(pdf).not.toBeNull()
    expect(pdf![0]).toBe(0x25)
    expect(pdf![1]).toBe(0x50)
  })

  it('detecte IM2 Husain comme image DX', () => {
    const buf = readFileSync(`${HUSAIN_DIR}/IM2`)
    const info = parseDicomContentInfo(buf)
    expect(info?.modality).toBe('DX')
    expect(info?.contentKind).toBe('image')
    expect(extractEncapsulatedPdf(buf)).toBeNull()
  })
})

describe('dicom-content (classification pure)', () => {
  it('classifie SOP Class PDF', () => {
    expect(
      classifyDicomContentFromHeader({
        modality: null,
        sopClassUid: ENCAPSULATED_PDF_SOP_CLASS,
        mimeType: null,
      }),
    ).toBe('encapsulated-pdf')
  })

  it('heuristique lot DOC par mediane de taille', () => {
    expect(
      isLikelyEncapsulatedPdfBand([
        { size: 76_390 },
        { size: 83_394 },
        { size: 96_000 },
      ]),
    ).toBe(true)
    expect(
      isLikelyEncapsulatedPdfBand([
        { size: 196_984 },
        { size: 203_002 },
        { size: 287_460 },
      ]),
    ).toBe(false)
  })
})
