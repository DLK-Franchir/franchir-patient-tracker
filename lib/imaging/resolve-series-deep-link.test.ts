import { describe, expect, it } from 'vitest'
import {
  normalizeSeriesDeepLinkQuery,
  resolveSeriesDeepLinkId,
} from './resolve-series-deep-link'

const candidates = [
  { id: 'dicom-series-suid:1.2.840.series-a', groupId: 'suid:1.2.840.series-a' },
  { id: 'dicom-series-series:SE000005', groupId: 'series:SE000005' },
  { id: 'dicom-pdf-series-patient-im-doc', groupId: 'patient-im-doc' },
  { id: 'questionnaire-dicom-series-suid:9.9.9', groupId: 'suid:9.9.9' },
]

describe('normalizeSeriesDeepLinkQuery', () => {
  it('trims and decodes URI components', () => {
    expect(normalizeSeriesDeepLinkQuery('  suid%3A1.2.3  ')).toBe('suid:1.2.3')
  })

  it('returns null for empty', () => {
    expect(normalizeSeriesDeepLinkQuery('')).toBeNull()
    expect(normalizeSeriesDeepLinkQuery('   ')).toBeNull()
    expect(normalizeSeriesDeepLinkQuery(null)).toBeNull()
  })
})

describe('resolveSeriesDeepLinkId', () => {
  it('matches full item id', () => {
    expect(resolveSeriesDeepLinkId('dicom-series-series:SE000005', candidates)).toBe(
      'dicom-series-series:SE000005',
    )
  })

  it('matches groupId', () => {
    expect(resolveSeriesDeepLinkId('series:SE000005', candidates)).toBe(
      'dicom-series-series:SE000005',
    )
    expect(resolveSeriesDeepLinkId('patient-im-doc', candidates)).toBe(
      'dicom-pdf-series-patient-im-doc',
    )
  })

  it('matches bare SeriesInstanceUID via suid: group', () => {
    expect(resolveSeriesDeepLinkId('1.2.840.series-a', candidates)).toBe(
      'dicom-series-suid:1.2.840.series-a',
    )
    expect(resolveSeriesDeepLinkId('suid:9.9.9', candidates)).toBe(
      'questionnaire-dicom-series-suid:9.9.9',
    )
  })

  it('returns null when unknown', () => {
    expect(resolveSeriesDeepLinkId('missing-uid', candidates)).toBeNull()
  })
})
