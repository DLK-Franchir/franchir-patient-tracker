import { describe, expect, it } from 'vitest'
import { groupDicomFilesByMetadata } from '@/lib/imaging/dicom-series-group'

/**
 * Parité clinicien : petits lots DOC (SeriesInstanceUID) → série PDF encapsulée,
 * pas une stack dwv image.
 */
describe('documents adapter — DOC PDF series routing', () => {
  it('marque les petits lots DOC encapsules pour le viewer PDF partage', () => {
    const groups = groupDicomFilesByMetadata([
      {
        name: 'doc1.dcm',
        url: 'https://example.test/doc1.dcm',
        size: 76_000,
        sopInstanceUid: 's-1',
        seriesInstanceUid: 'docs',
        instanceNumber: 1,
      },
      {
        name: 'doc2.dcm',
        url: 'https://example.test/doc2.dcm',
        size: 83_000,
        sopInstanceUid: 's-2',
        seriesInstanceUid: 'docs',
        instanceNumber: 2,
      },
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0]?.isEncapsulatedPdf).toBe(true)
  })
})
