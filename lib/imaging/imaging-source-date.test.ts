import { describe, expect, it } from 'vitest'
import {
  filterImagingBySourceDate,
  formatSourceDateLabel,
  imagingDateFilterOptions,
  imagingSourceDate,
  sourceDateKey,
} from '@/lib/imaging/imaging-source-date'

describe('sourceDateKey', () => {
  it('lit la date DICOM et ignore l heure', () => {
    expect(sourceDateKey('20261014111700')).toBe('2026-10-14')
    expect(sourceDateKey('2026-10-14')).toBe('2026-10-14')
  })

  it('refuse une date absente ou invalide', () => {
    expect(sourceDateKey(null)).toBeNull()
    expect(sourceDateKey('')).toBeNull()
    expect(sourceDateKey('20261340')).toBeNull()
  })
})

describe('imagingSourceDate', () => {
  it('prend le jour d examen le plus ancien de la série', () => {
    expect(imagingSourceDate(['20261014120000', null, '20261010101010'])).toBe('2026-10-10')
  })
})

describe('formatSourceDateLabel', () => {
  it('affiche le jour en français', () => {
    expect(formatSourceDateLabel('2026-10-14')).toBe('14 oct. 2026')
  })
})

describe('filterImagingBySourceDate', () => {
  const items = [
    { id: 'a', sourceDate: '2026-10-14' },
    { id: 'b', sourceDate: '2026-03-01' },
    { id: 'c', sourceDate: null },
  ]

  it('trie du plus récent au plus ancien et laisse les fichiers sans date à la fin', () => {
    expect(filterImagingBySourceDate(items, 'all', 'newest').map((item) => item.id)).toEqual([
      'a',
      'b',
      'c',
    ])
  })

  it('trie du plus ancien au plus récent', () => {
    expect(filterImagingBySourceDate(items, 'all', 'oldest').map((item) => item.id)).toEqual([
      'b',
      'a',
      'c',
    ])
  })

  it('filtre un jour d examen', () => {
    expect(filterImagingBySourceDate(items, 'date:2026-10-14', 'newest').map((item) => item.id)).toEqual([
      'a',
    ])
  })

  it('isole les fichiers sans date d examen', () => {
    expect(filterImagingBySourceDate(items, 'undated', 'newest').map((item) => item.id)).toEqual(['c'])
  })

  it('propose les dates présentes, de la plus récente à la plus ancienne', () => {
    expect(imagingDateFilterOptions(items.map((item) => item.sourceDate)).map((option) => option.label)).toEqual([
      'Toutes',
      '14 oct. 2026',
      '1 mars 2026',
      'Sans date',
    ])
  })
})
