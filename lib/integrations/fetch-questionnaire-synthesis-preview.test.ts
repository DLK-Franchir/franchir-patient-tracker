import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchQuestionnaireSynthesisPreview } from './fetch-questionnaire-synthesis-preview'

describe('fetchQuestionnaireSynthesisPreview', () => {
  const originalToken = process.env.TRACKER_SYNC_SERVICE_TOKEN

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    process.env.TRACKER_SYNC_SERVICE_TOKEN = originalToken
    vi.unstubAllGlobals()
  })

  it('retourne 503 si le token pont est absent', async () => {
    delete process.env.TRACKER_SYNC_SERVICE_TOKEN
    const result = await fetchQuestionnaireSynthesisPreview('00000000-0000-4000-8000-000000000001')
    expect(result).toEqual({
      ok: false,
      status: 503,
      message: 'Pont questionnaires non configure',
    })
  })

  it('retourne la preview JSON quand le pont repond 200', async () => {
    process.env.TRACKER_SYNC_SERVICE_TOKEN = 'test-token'
    const preview = {
      sessionId: '11111111-1111-4111-8111-111111111111',
      generatedAt: '2026-06-01T10:00:00.000Z',
      profile: {},
      flags: [],
      antecedents: [],
      treatments: [],
      timeline: [],
      imagingRows: [],
      scores: {
        eva: 7,
        evaInterpretation: 'Moderee',
        ndiPct: 42,
        ndiLabel: 'Severe',
      },
      completion: { overall: 100, status: 'completed', sections: [] },
    }

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(preview), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    const result = await fetchQuestionnaireSynthesisPreview('00000000-0000-4000-8000-000000000001')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.preview.sessionId).toBe(preview.sessionId)
    }
  })

  it('retourne 404 si aucune synthese disponible', async () => {
    process.env.TRACKER_SYNC_SERVICE_TOKEN = 'test-token'
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 404 }))

    const result = await fetchQuestionnaireSynthesisPreview('00000000-0000-4000-8000-000000000001')
    expect(result).toEqual({
      ok: false,
      status: 404,
      message: 'Aucune synthese disponible pour ce patient',
    })
  })

  it('signale un endpoint questionnaires non deploye si la reponse est HTML', async () => {
    process.env.TRACKER_SYNC_SERVICE_TOKEN = 'test-token'
    vi.mocked(fetch).mockResolvedValue(
      new Response('<html>404</html>', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }),
    )

    const result = await fetchQuestionnaireSynthesisPreview('00000000-0000-4000-8000-000000000001')
    expect(result).toEqual({
      ok: false,
      status: 503,
      message:
        'Endpoint synthese absent cote questionnaires — redeployer patient-synthesis-preview',
    })
  })
})
