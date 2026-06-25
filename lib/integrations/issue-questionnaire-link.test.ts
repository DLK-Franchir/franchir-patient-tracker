import { describe, expect, it, vi, beforeEach } from 'vitest'
import { markQuestionnaireLinkIssued } from '@/lib/integrations/issue-questionnaire-link'

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
