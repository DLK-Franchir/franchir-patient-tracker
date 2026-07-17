import { describe, expect, it } from 'vitest'
import {
  groupDicomFilesByMetadata,
  type MetaImagingFile,
} from './dicom-series-group'

describe('groupDicomFilesByMetadata', () => {
  it('sépare cervical et lombaire par SeriesInstanceUID', () => {
    const files: MetaImagingFile[] = [
      {
        name: 'a.dcm',
        url: 'u-a',
        size: 200_000,
        sopInstanceUid: 'sop-c2',
        seriesInstanceUid: 'series-cervical',
        seriesDescription: 'T2 CERVICAL',
        bodyPart: 'CSPINE',
        instanceNumber: 2,
      },
      {
        name: 'b.dcm',
        url: 'u-b',
        size: 200_000,
        sopInstanceUid: 'sop-c1',
        seriesInstanceUid: 'series-cervical',
        seriesDescription: 'T2 CERVICAL',
        bodyPart: 'CSPINE',
        instanceNumber: 1,
      },
      {
        name: 'c.dcm',
        url: 'u-c',
        size: 200_000,
        sopInstanceUid: 'sop-l1',
        seriesInstanceUid: 'series-lombaire',
        seriesDescription: 'T2 LOMBAIRE',
        bodyPart: 'LSPINE',
        instanceNumber: 1,
      },
    ]
    const groups = groupDicomFilesByMetadata(files)
    expect(groups).toHaveLength(2)
    const cervical = groups.find((g) => g.groupId === 'suid:series-cervical')
    const lombaire = groups.find((g) => g.groupId === 'suid:series-lombaire')
    expect(cervical?.files.map((f) => f.url)).toEqual(['u-b', 'u-a']) // trié par instanceNumber
    expect(cervical?.label).toBe('T2 CERVICAL (2 images)')
    expect(lombaire?.files).toHaveLength(1)
    expect(lombaire?.label).toBe('T2 LOMBAIRE (1 image)')
  })

  it('déduplique par SOPInstanceUID au sein d’une série', () => {
    const files: MetaImagingFile[] = [
      { name: 'a.dcm', url: 'keep', size: 200_000, sopInstanceUid: 'dup', seriesInstanceUid: 's1', instanceNumber: 1 },
      { name: 'a-2.dcm', url: 'drop', size: 273_000, sopInstanceUid: 'dup', seriesInstanceUid: 's1', instanceNumber: 1 },
      { name: 'b.dcm', url: 'other', size: 200_000, sopInstanceUid: 'uniq', seriesInstanceUid: 's2', instanceNumber: 1 },
    ]
    const groups = groupDicomFilesByMetadata(files)
    const all = groups.flatMap((g) => g.files.map((f) => f.url))
    expect(all).toContain('keep')
    expect(all).not.toContain('drop')
    expect(all).toContain('other')
  })

  it('retombe sur la hiérarchie date/heure quand une seule série', () => {
    const files: MetaImagingFile[] = [
      { name: 'a.dcm', url: 'd1-a', sopInstanceUid: 'x1', seriesInstanceUid: 'same', acquisitionDatetime: '20230101120000', instanceNumber: 1 },
      { name: 'b.dcm', url: 'd2-a', sopInstanceUid: 'x2', seriesInstanceUid: 'same', acquisitionDatetime: '20240202090000', instanceNumber: 1 },
    ]
    const groups = groupDicomFilesByMetadata(files)
    expect(groups).toHaveLength(2)
    expect(groups.map((g) => g.groupId).sort()).toEqual(['date:20230101', 'date:20240202'])
  })

  it('retombe sur le grouping historique sans métadonnées', () => {
    const files: MetaImagingFile[] = [
      { name: '1781451087388_DICOMS_IM000001.dcm', url: 'a1', size: 200_000 },
      { name: '1781451087388_DICOMS_IM000002.dcm', url: 'a2', size: 210_000 },
    ]
    const groups = groupDicomFilesByMetadata(files)
    expect(groups).toHaveLength(1)
    expect(groups[0]?.groupId).toBe('patient-im')
    expect(groups[0]?.isEncapsulatedPdf).toBe(false)
    expect(groups[0]?.files).toHaveLength(2)
  })

  it('marque un lot de DOC encapsulés (petite taille) comme PDF', () => {
    const files: MetaImagingFile[] = [
      { name: 'doc1.dcm', url: 'p1', size: 76_000, sopInstanceUid: 's-1', seriesInstanceUid: 'docs', instanceNumber: 1 },
      { name: 'doc2.dcm', url: 'p2', size: 83_000, sopInstanceUid: 's-2', seriesInstanceUid: 'docs', instanceNumber: 2 },
    ]
    const groups = groupDicomFilesByMetadata(files)
    // une seule série → repli date/heure (pas de date ici) → un groupe unique
    expect(groups).toHaveLength(1)
    expect(groups[0]?.isEncapsulatedPdf).toBe(true)
  })
})
