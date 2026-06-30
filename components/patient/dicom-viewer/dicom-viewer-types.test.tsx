import { describe, expect, it } from 'vitest'
import { formatDicomLoadError } from '@/components/patient/dicom-viewer/dicom-viewer-types'

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
