import { describe, expect, it } from 'vitest'
import type { PatientDocument } from '@/lib/documents/patient-documents'
import { toQuestionnairesImagingDocument } from '@/lib/integrations/questionnaires-imaging-document'

function doc(partial: Partial<PatientDocument> & Pick<PatientDocument, 'fileName' | 'renderType'>): PatientDocument {
  return {
    id: 'doc-1',
    kind: partial.renderType === 'dicom' ? 'dicom' : 'document',
    mimeType: null,
    sizeBytes: 1000,
    createdAt: '2026-01-01T00:00:00Z',
    url: 'https://signed.example/x',
    sopInstanceUid: null,
    seriesInstanceUid: null,
    seriesDescription: null,
    bodyPart: null,
    instanceNumber: null,
    acquisitionDatetime: null,
    ...partial,
  }
}

describe('toQuestionnairesImagingDocument', () => {
  it('propage SeriesInstanceUID et description pour le grouping clinicien', () => {
    const mapped = toQuestionnairesImagingDocument(
      doc({
        fileName: '33230000_55618353.dcm',
        renderType: 'dicom',
        seriesInstanceUid: '1.2.3.series',
        seriesDescription: 'AX T1 FS POST',
        sopInstanceUid: '1.2.3.sop',
        instanceNumber: 4,
        bodyPart: 'SPINE',
        acquisitionDatetime: '20240101120000',
      }),
    )
    expect(mapped).toMatchObject({
      fileName: '33230000_55618353.dcm',
      renderType: 'dicom',
      seriesInstanceUid: '1.2.3.series',
      seriesDescription: 'AX T1 FS POST',
      sopInstanceUid: '1.2.3.sop',
      instanceNumber: 4,
      bodyPart: 'SPINE',
      acquisitionDatetime: '20240101120000',
    })
  })

  it('exclut video et other', () => {
    expect(toQuestionnairesImagingDocument(doc({ fileName: 'a.mp4', renderType: 'video' }))).toBeNull()
    expect(toQuestionnairesImagingDocument(doc({ fileName: 'a.bin', renderType: 'other' }))).toBeNull()
  })
})
