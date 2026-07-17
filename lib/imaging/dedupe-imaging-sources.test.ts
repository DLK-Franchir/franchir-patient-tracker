import { describe, expect, it } from 'vitest'
import {
  filterQuestionnaireImagingAgainstTracker,
  normalizeImagingBasename,
  stripImagingStoragePrefixes,
  type QuestionnaireImagingRef,
  type TrackerImagingRef,
} from '@/lib/imaging/dedupe-imaging-sources'

describe('stripImagingStoragePrefixes', () => {
  it('aligne stem DICOM tracker et forward questionnaire', () => {
    expect(stripImagingStoragePrefixes('33230000_55618353.dcm')).toBe('55618353.dcm')
    expect(stripImagingStoragePrefixes('1782839857704_33230000_55618353.dcm')).toBe(
      '55618353.dcm',
    )
  })

  it('retire le timestamp upload sans casser le stem image', () => {
    expect(
      stripImagingStoragePrefixes('1782839900000_267242_scan_1-1.jpg'),
    ).toBe('scan_1-1.jpg')
  })
})

describe('normalizeImagingBasename', () => {
  it('unifie espaces et underscores', () => {
    expect(normalizeImagingBasename('33230000_scan 1-1.jpg')).toBe('scan_1-1.jpg')
    expect(normalizeImagingBasename('1782839900000_33230000_scan_1-1.jpg')).toBe(
      'scan_1-1.jpg',
    )
  })
})

describe('filterQuestionnaireImagingAgainstTracker', () => {
  const trackerDicom: TrackerImagingRef[] = [
    {
      fileName: '33230000_55618353.dcm',
      renderType: 'dicom',
      sizeBytes: 626_658,
      seriesInstanceUid: '1.2.3.sag-t1',
      sopInstanceUid: 'sop-1',
    },
    {
      fileName: '33230000_55618364.dcm',
      renderType: 'dicom',
      sizeBytes: 626_654,
      seriesInstanceUid: '1.2.3.sag-t1',
      sopInstanceUid: 'sop-2',
    },
    {
      fileName: 'xray_front.jpg',
      renderType: 'image',
      sizeBytes: 151_552,
    },
  ]

  it('masque les DICOM questionnaire du meme SeriesInstanceUID', () => {
    const q: QuestionnaireImagingRef[] = [
      {
        name: '1782839857704_33230000_99999999.dcm',
        type: 'dicom',
        size: 100,
        seriesInstanceUid: '1.2.3.sag-t1',
        sopInstanceUid: 'sop-other',
      },
      {
        name: 'only-on-q.dcm',
        type: 'dicom',
        size: 200_000,
        seriesInstanceUid: '1.2.3.unique-q',
        sopInstanceUid: 'sop-q',
      },
    ]
    const kept = filterQuestionnaireImagingAgainstTracker(trackerDicom, q)
    expect(kept.map((f) => f.name)).toEqual(['only-on-q.dcm'])
  })

  it('masque les DICOM questionnaire au meme stem (sans SUID cote Q)', () => {
    const q: QuestionnaireImagingRef[] = [
      {
        name: '1782839857704_33230000_55618353.dcm',
        type: 'dicom',
        size: 626_658,
      },
      {
        name: '1782839857705_patient_only.dcm',
        type: 'dicom',
        size: 300_000,
      },
    ]
    const kept = filterQuestionnaireImagingAgainstTracker(trackerDicom, q)
    expect(kept.map((f) => f.name)).toEqual(['1782839857705_patient_only.dcm'])
  })

  it('masque les JPEG forwardes deja presents sur le tracker', () => {
    const q: QuestionnaireImagingRef[] = [
      {
        name: '1782839900001_xray_front.jpg',
        type: 'image',
        size: 151_552,
      },
      {
        name: '1782839900002_patient_photo.jpg',
        type: 'image',
        size: 90_000,
      },
      {
        name: '1782839900003_xray_front.jpg',
        type: 'image',
        size: 151_552,
      },
    ]
    const kept = filterQuestionnaireImagingAgainstTracker(trackerDicom, q)
    expect(kept.map((f) => f.name)).toEqual(['1782839900002_patient_photo.jpg'])
  })

  it('ne filtre rien si le tracker est vide', () => {
    const q: QuestionnaireImagingRef[] = [
      { name: 'a.dcm', type: 'dicom', seriesInstanceUid: 's1' },
    ]
    expect(filterQuestionnaireImagingAgainstTracker([], q)).toEqual(q)
  })

  it('reproduit le cas Tania: 11 series tracker + forward Q → Q vide pour le MRI', () => {
    const series = [
      { uid: 's-ax-t1', stem: '55618353' },
      { uid: 's-sag-t1', stem: '55616846' },
      { uid: 's-localizer', stem: '55616637' },
    ]
    const tracker: TrackerImagingRef[] = series.flatMap((s, i) => [
      {
        fileName: `33230000_${s.stem}.dcm`,
        renderType: 'dicom' as const,
        sizeBytes: 600_000 + i,
        seriesInstanceUid: s.uid,
        sopInstanceUid: `sop-${s.stem}`,
      },
    ])
    const q: QuestionnaireImagingRef[] = series.map((s, i) => ({
      name: `${1782839857704 + i}_33230000_${s.stem}.dcm`,
      type: 'dicom' as const,
      size: 600_000 + i,
      seriesInstanceUid: s.uid,
      sopInstanceUid: `sop-${s.stem}`,
    }))
    expect(filterQuestionnaireImagingAgainstTracker(tracker, q)).toEqual([])
  })
})
