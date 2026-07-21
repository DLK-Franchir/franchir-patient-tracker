import { describe, expect, it } from 'vitest'
import { canPerformWorkflowAction } from '@/lib/workflow-v2'

describe('change-status role guard (canPerformWorkflowAction)', () => {
  it('refuse à Marcel la validation / complément réservés à Gilles', () => {
    expect(canPerformWorkflowAction('marcel', 'approve_medical')).toBe(false)
    expect(canPerformWorkflowAction('marcel', 'request_more_info')).toBe(false)
  })

  it('autorise Marcel à passer un dossier en mode refusé et à le réouvrir', () => {
    expect(canPerformWorkflowAction('marcel', 'reject_medical')).toBe(true)
    expect(canPerformWorkflowAction('marcel', 'reopen_case', 'rejected')).toBe(true)
  })

  it('refuse à Gilles l\'assignation chirurgien', () => {
    expect(canPerformWorkflowAction('gilles', 'assign_surgeon')).toBe(false)
  })

  it('autorise Gilles sur approve_medical', () => {
    expect(canPerformWorkflowAction('gilles', 'approve_medical')).toBe(true)
  })
})
