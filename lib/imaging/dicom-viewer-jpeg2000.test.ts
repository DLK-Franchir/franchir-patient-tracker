import { describe, expect, it } from 'vitest'
import { isUnsupportedJpeg2000Error } from '@/components/patient/dicom-viewer/dicom-viewer-types'

describe('isUnsupportedJpeg2000Error', () => {
  it('détecte l\'erreur JPX réelle des radios DX Husain', () => {
    expect(
      isUnsupportedJpeg2000Error(
        'Uncaught Error: JPX Error: Unsupported COD options (selectiveArithmeticCodingBypass)',
      ),
    ).toBe(true)
  })

  it('détecte les variantes de message', () => {
    expect(isUnsupportedJpeg2000Error('JPX Error: something')).toBe(true)
    expect(isUnsupportedJpeg2000Error('Unsupported COD options (foo)')).toBe(true)
    expect(isUnsupportedJpeg2000Error('selectiveArithmeticCodingBypass')).toBe(true)
  })

  it('ignore les messages sans rapport', () => {
    expect(isUnsupportedJpeg2000Error('Cannot append a slice with different orientation')).toBe(
      false,
    )
    expect(isUnsupportedJpeg2000Error('codec not supported')).toBe(false)
    expect(isUnsupportedJpeg2000Error(null)).toBe(false)
    expect(isUnsupportedJpeg2000Error(undefined)).toBe(false)
    expect(isUnsupportedJpeg2000Error('')).toBe(false)
  })
})
