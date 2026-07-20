import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadDicomZip } from './trigger-dicom-zip-download'

describe('downloadDicomZip', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('signale 413 study_too_large avec message UX', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            error: 'study_too_large',
            message: 'Étude trop volumineuse pour un export sync.',
            hint: 'series_export',
          }),
          { status: 413, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )
    const result = await downloadDicomZip('/api/patients/x/imaging/study/export.zip')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(413)
      expect(result.message).toMatch(/volumineuse/i)
      expect(result.hint).toBe('series_export')
    }
  })

  it('signale erreur HTTP non-413', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
    const result = await downloadDicomZip('/api/patients/x/imaging/series/s1/export.zip')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(403)
      expect(result.message).toMatch(/Forbidden|Échec/i)
    }
  })
})
