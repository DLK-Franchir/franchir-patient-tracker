import { describe, expect, it } from 'vitest'
import {
  formatDicomLoadError,
  orientationFallbackMessage,
  SEQUENTIAL_LOCALIZER_ORIENTATION_MSG,
  SEQUENTIAL_ORIENTATION_FALLBACK_MSG,
} from '@/components/patient/dicom-viewer/dicom-viewer-types'

describe('formatDicomLoadError', () => {
  it('signale un JWT Supabase Storage expiré', () => {
    expect(
      formatDicomLoadError(
        '{"statusCode":"400","error":"InvalidJWT","message":"\\"exp\\" claim timestamp check failed"}',
      ),
    ).toBe('Lien imagerie expiré — fermez la visionneuse et rouvrez la série')
  })

  it('conserve le message dwv pour les autres erreurs', () => {
    expect(formatDicomLoadError('orientation mismatch')).toBe('orientation mismatch')
  })
})

describe('orientationFallbackMessage', () => {
  it('explique le multi-plans pour un localizer', () => {
    expect(orientationFallbackMessage('localizer (8 images)')).toBe(
      SEQUENTIAL_LOCALIZER_ORIENTATION_MSG,
    )
    expect(SEQUENTIAL_LOCALIZER_ORIENTATION_MSG).toMatch(/AX\/SAG\/COR/)
  })

  it('garde le message générique pour les autres séries', () => {
    expect(orientationFallbackMessage('SAG T1 (19 images)')).toBe(
      SEQUENTIAL_ORIENTATION_FALLBACK_MSG,
    )
  })
})
