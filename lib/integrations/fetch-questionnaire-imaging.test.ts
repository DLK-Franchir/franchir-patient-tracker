import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchQuestionnairePatientImages } from '@/lib/integrations/fetch-questionnaire-imaging'

describe('fetchQuestionnairePatientImages', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('demande enrichMetadata=0 par defaut (evite Range GETs pont)', async () => {
    vi.stubEnv('TRACKER_SYNC_SERVICE_TOKEN', 'test-token')
    const fetchMock = vi.fn(async (_url: string) => ({
      ok: true,
      json: async () => ({ files: [] }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    await fetchQuestionnairePatientImages('00000000-0000-4000-8000-000000000001')

    expect(fetchMock).toHaveBeenCalledOnce()
    const calledUrl = fetchMock.mock.calls[0]![0]
    expect(calledUrl).toContain('enrichMetadata=0')
    expect(calledUrl).toContain('trackerPatientId=00000000-0000-4000-8000-000000000001')
  })

  it('autorise enrichMetadata=1 si demande', async () => {
    vi.stubEnv('TRACKER_SYNC_SERVICE_TOKEN', 'test-token')
    const fetchMock = vi.fn(async (_url: string) => ({
      ok: true,
      json: async () => ({ files: [] }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    await fetchQuestionnairePatientImages('00000000-0000-4000-8000-000000000001', {
      enrichMetadata: true,
    })

    const calledUrl = fetchMock.mock.calls[0]![0]
    expect(calledUrl).toContain('enrichMetadata=1')
  })
})
