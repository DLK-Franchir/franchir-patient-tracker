import { describe, expect, it } from 'vitest'
import {
  SEQUENTIAL_ORIENTATION_FALLBACK_MSG,
  isStackOrientationMismatch,
} from '@/components/patient/dicom-viewer/dicom-viewer-types'

describe('isStackOrientationMismatch', () => {
  it('détecte le message dwv standard', () => {
    expect(
      isStackOrientationMismatch('Cannot append a slice with different orientation'),
    ).toBe(true)
  })

  it('ignore les messages sans rapport', () => {
    expect(isStackOrientationMismatch('codec not supported')).toBe(false)
    expect(isStackOrientationMismatch(null)).toBe(false)
  })

  it('expose le message utilisateur de repli séquentiel', () => {
    expect(SEQUENTIAL_ORIENTATION_FALLBACK_MSG).toMatch(/Orientations d'images incompatibles/)
  })
})
