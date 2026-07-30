import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  markQuestionnaireLinkIssued,
  postQuestionnaireBridge,
  issueQuestionnaireLink,
  reconcileQuestionnaireSentStatus,
} from '@/lib/integrations/issue-questionnaire-link'

/** update().eq('id') — awaitable AND chainable (.eq status) for reconcile. */
const eqAfterUpdateSecond = vi.fn().mockResolvedValue({ error: null })
const eqAfterUpdate = vi.fn().mockImplementation(() =>
  Object.assign(Promise.resolve({ error: null }), { eq: eqAfterUpdateSecond }),
)
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

describe('reconcileQuestionnaireSentStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ne corrige pas si lien portail actif (dispatch staff)', async () => {
    const did = await reconcileQuestionnaireSentStatus('patient-1', null, 'sent', true)
    expect(did).toBe(false)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('corrige sent orphelin sans lien portail', async () => {
    const did = await reconcileQuestionnaireSentStatus('patient-1', null, 'sent', false)
    expect(did).toBe(true)
    expect(updateMock).toHaveBeenCalledWith({
      questionnaire_status: null,
      questionnaire_sent_at: null,
    })
  })
})

describe('markQuestionnaireLinkIssued', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    maybeSingleMock.mockResolvedValue({
      data: {
        questionnaire_status: null,
        patient_email: 'patient@example.com',
        form_types: ['cervical'],
      },
    })
  })

  it('ne met pas sent si email non expédié', async () => {
    await markQuestionnaireLinkIssued('patient-1', false)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('met sent si email expédié', async () => {
    await markQuestionnaireLinkIssued('patient-1', true)
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        questionnaire_status: 'sent',
        questionnaire_sent_at: expect.any(String),
      }),
    )
    expect(eqAfterUpdate).toHaveBeenCalledWith('id', 'patient-1')
  })
})

describe('postQuestionnaireBridge', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('envoie patientEmail et sendEmail dans le body quand présents', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ emailSent: true }), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    await postQuestionnaireBridge(
      {
        trackerPatientId: '196c8313-8308-4bbc-94af-a55a923f0116',
        patientEmail: 'patient@example.com',
        sendEmail: false,
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
          sendEmail: false,
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
    updateMock.mockReturnValue({ eq: eqAfterUpdate })
    eqAfterUpdate.mockResolvedValue({ error: null })
    maybeSingleMock.mockResolvedValue({
      data: {
        questionnaire_status: null,
        patient_email: 'patient@example.com',
        form_types: ['cervical'],
      },
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

  it('force newSession quand form_types change', async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        questionnaire_status: null,
        patient_email: 'patient@example.com',
        form_types: ['cervical'],
      },
    })

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          emailSent: false,
          expiresAt: null,
          url: 'https://questionnaire.franchir.eu/p/token',
        }),
        { status: 201 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await issueQuestionnaireLink({
      patientId: 'patient-1',
      formTypes: ['lombaire'],
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.dispatchMode).toBe('staff')
      expect(result.url).toContain('https://')
    }
    expect(updateMock).toHaveBeenCalledWith({ form_types: ['lombaire'] })
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/questionnaire-link'),
      expect.objectContaining({
        body: expect.stringContaining('"newSession":true'),
      }),
    )
    expect(fetchMock.mock.calls[0][1].body).toContain('"sendEmail":false')
  })

  it('mode staff : url sans marquer sent', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          emailSent: false,
          url: 'https://questionnaire.franchir.eu/p/abc',
          emailDraft: { subject: 'Sujet', textBody: 'Corps' },
        }),
        { status: 201 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await issueQuestionnaireLink({ patientId: 'patient-1' })

    expect(result).toMatchObject({
      ok: true,
      dispatchMode: 'staff',
      emailSent: false,
      url: 'https://questionnaire.franchir.eu/p/abc',
      emailDraft: { subject: 'Sujet', textBody: 'Corps' },
    })
    expect(updateMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ questionnaire_status: 'sent' }),
    )
  })

  it('legacy Resend si emailSent sans url', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ emailSent: true }), { status: 201 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await issueQuestionnaireLink({ patientId: 'patient-1' })

    expect(result).toMatchObject({
      ok: true,
      dispatchMode: 'legacy_resend',
      emailSent: true,
      url: null,
    })
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ questionnaire_status: 'sent' }),
    )
  })

  it('url_missing si sendEmail=false sans url ni email', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ emailSent: false }), { status: 201 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await issueQuestionnaireLink({ patientId: 'patient-1', sendEmail: false })

    expect(result).toMatchObject({ ok: false, code: 'url_missing', httpStatus: 502 })
  })

  it('ne met pas a jour form_types si identiques', async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        questionnaire_status: null,
        patient_email: 'patient@example.com',
        form_types: ['cervical', 'lombaire'],
      },
    })

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ emailSent: false, url: 'https://questionnaire.franchir.eu/p/x' }),
        { status: 201 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await issueQuestionnaireLink({
      patientId: 'patient-1',
      formTypes: ['lombaire', 'cervical'],
    })

    expect(updateMock).not.toHaveBeenCalledWith({ form_types: expect.anything() })
  })

  it('ne met pas a jour form_types si dossier completed', async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        questionnaire_status: 'completed',
        patient_email: 'patient@example.com',
        form_types: ['cervical'],
      },
    })

    const result = await issueQuestionnaireLink({
      patientId: 'patient-1',
      formTypes: ['lombaire'],
    })

    expect(result).toMatchObject({ ok: false, httpStatus: 409, code: 'completed' })
    expect(updateMock).not.toHaveBeenCalledWith({ form_types: expect.anything() })
  })

  it('met a jour questionnaire_language puis sync avant emission (fr→en)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ emailSent: false, url: 'https://questionnaire.franchir.eu/p/y' }),
        { status: 201 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await issueQuestionnaireLink({
      patientId: 'patient-1',
      language: 'en',
      formTypes: ['cervical'],
    })

    expect(result.ok).toBe(true)
    expect(updateMock).toHaveBeenCalledWith({ questionnaire_language: 'en' })
    expect(syncPatientToQuestionnaires).toHaveBeenCalledWith('patient-1')
    expect(vi.mocked(syncPatientToQuestionnaires).mock.invocationCallOrder[0]).toBeLessThan(
      fetchMock.mock.invocationCallOrder[0],
    )
  })
})
