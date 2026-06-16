import { describe, expect, it } from 'vitest'
import { canPerformWorkflowAction } from '@/lib/workflow-v2'

describe('change-status role guard (canPerformWorkflowAction)', () => {
  it('refuse à Marcel les actions médicales réservées à Gilles', () => {
    expect(canPerformWorkflowAction('marcel', 'approve_medical')).toBe(false)
    expect(canPerformWorkflowAction('marcel', 'reject_medical')).toBe(false)
  })

  it('refuse à Gilles l\'assignation chirurgien', () => {
    expect(canPerformWorkflowAction('gilles', 'assign_surgeon')).toBe(false)
  })

  it('autorise Gilles sur approve_medical', () => {
    expect(canPerformWorkflowAction('gilles', 'approve_medical')).toBe(true)
  })
})
