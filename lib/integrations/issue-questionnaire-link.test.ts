import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  markQuestionnaireLinkIssued,
  postQuestionnaireBridge,
  QUESTIONNAIRE_BRIDGE_FETCH_TIMEOUT_MS,
} from '@/lib/integrations/issue-questionnaire-link'

const eqAfterUpdate = vi.fn().mockResolvedValue({ error: null })
const updateMock = vi.fn().mockReturnValue({ eq: eqAfterUpdate })
const maybeSingleMock = vi.fn().mockResolvedValue({ data: { questionnaire_status: null } })
const eqAfterSelect = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock })
const selectMock = vi.fn().mockReturnValue({ eq: eqAfterSelect })

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: () => ({
    from: () => ({
      select: selectMock,
      update: updateMock,
    }),
  }),
}))

describe('markQuestionnaireLinkIssued', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    maybeSingleMock.mockResolvedValue({ data: { questionnaire_status: null } })
  })

  it('ne met pas sent si email non expédié', async () => {
    await markQuestionnaireLinkIssued('patient-1', false)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('met sent si email expédié', async () => {
    await markQuestionnaireLinkIssued('patient-1', true)
    expect(updateMock).toHaveBeenCalledWith({ questionnaire_status: 'sent' })
    expect(eqAfterUpdate).toHaveBeenCalledWith('id', 'patient-1')
  })
})

describe('postQuestionnaireBridge', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('envoie patientEmail dans le body quand présent côté tracker', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ emailSent: true }), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    await postQuestionnaireBridge(
      {
        trackerPatientId: '196c8313-8308-4bbc-94af-a55a923f0116',
        patientEmail: 'marcel.mazaltarim@gmail.com',
      },
      'service-token',
    )

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/questionnaire-link'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          trackerPatientId: '196c8313-8308-4bbc-94af-a55a923f0116',
          patientEmail: 'marcel.mazaltarim@gmail.com',
        }),
        signal: expect.any(AbortSignal),
      }),
    )

    vi.unstubAllGlobals()
  })

  it('expose un timeout bridge de 30 s', () => {
    expect(QUESTIONNAIRE_BRIDGE_FETCH_TIMEOUT_MS).toBe(30_000)
  })
})
