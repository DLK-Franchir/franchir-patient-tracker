import { describe, expect, it } from 'vitest'
import { isNonImageDicomModality } from './dicom-series-group'

describe('isNonImageDicomModality', () => {
  it('masque les comptes rendus SR et autres parasites CD', () => {
    expect(isNonImageDicomModality('SR')).toBe(true)
    expect(isNonImageDicomModality('sr')).toBe(true)
    expect(isNonImageDicomModality('PR')).toBe(true)
    expect(isNonImageDicomModality('KO')).toBe(true)
    expect(isNonImageDicomModality('RTSTRUCT')).toBe(true)
    expect(isNonImageDicomModality('SEG')).toBe(true)
  })

  it('conserve les modalités image et DOC (PDF encapsulé)', () => {
    expect(isNonImageDicomModality('MR')).toBe(false)
    expect(isNonImageDicomModality('CT')).toBe(false)
    expect(isNonImageDicomModality('DOC')).toBe(false)
    expect(isNonImageDicomModality(null)).toBe(false)
    expect(isNonImageDicomModality('')).toBe(false)
  })
})
