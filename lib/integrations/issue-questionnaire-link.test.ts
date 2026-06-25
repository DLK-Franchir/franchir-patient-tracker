import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  markQuestionnaireLinkIssued,
  postQuestionnaireBridge,
  issueQuestionnaireLink,
} from '@/lib/integrations/issue-questionnaire-link'

const eqAfterUpdate = vi.fn().mockResolvedValue({ error: null })
const updateMock = vi.fn().mockReturnValue({ eq: eqAfterUpdate })
const maybeSingleMock = vi.fn().mockResolvedValue({
  data: { questionnaire_status: null, patient_email: 'patient@example.com' },
})
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

vi.mock('@/lib/integrations/questionnaire-portal', () => ({
  syncPatientToQuestionnaires: vi.fn(),
}))

import { syncPatientToQuestionnaires } from '@/lib/integrations/questionnaire-portal'

describe('markQuestionnaireLinkIssued', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    maybeSingleMock.mockResolvedValue({
      data: { questionnaire_status: null, patient_email: 'patient@example.com' },
    })
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
        patientEmail: 'patient@example.com',
      },
      'service-token',
    )

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/questionnaire-link'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          trackerPatientId: '196c8313-8308-4bbc-94af-a55a923f0116',
          patientEmail: 'patient@example.com',
        }),
        signal: expect.any(AbortSignal),
      }),
    )

    vi.unstubAllGlobals()
  })
})

describe('issueQuestionnaireLink', () => {
  const originalToken = process.env.TRACKER_SYNC_SERVICE_TOKEN

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TRACKER_SYNC_SERVICE_TOKEN = 'service-token'
    vi.mocked(syncPatientToQuestionnaires).mockResolvedValue(true)
    selectMock.mockReturnValue({ eq: eqAfterSelect })
    eqAfterSelect.mockReturnValue({ maybeSingle: maybeSingleMock })
    maybeSingleMock.mockResolvedValue({
      data: { questionnaire_status: null, patient_email: 'patient@example.com' },
    })
  })

  afterEach(() => {
    process.env.TRACKER_SYNC_SERVICE_TOKEN = originalToken
    vi.unstubAllGlobals()
  })

  it('retourne upstream structuré si le pont questionnaires est injoignable (timeout)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('The operation was aborted', 'AbortError')))

    const result = await issueQuestionnaireLink({ patientId: 'patient-1' })

    expect(result).toEqual({
      ok: false,
      httpStatus: 502,
      error: expect.stringContaining('injoignable'),
      code: 'upstream',
    })
  })
})
