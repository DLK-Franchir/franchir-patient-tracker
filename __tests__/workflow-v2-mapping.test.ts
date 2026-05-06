import { describe, it, expect } from 'vitest'
import { globalStatusFromWorkflowStatus, type WorkflowStatus } from '../lib/workflow-v2'

function ws(partial: Partial<WorkflowStatus>): WorkflowStatus {
  return { id: 'test-id', ...partial } as WorkflowStatus
}

describe('globalStatusFromWorkflowStatus', () => {
  it('returns draft when status is null', () => {
    expect(globalStatusFromWorkflowStatus(null)).toBe('draft')
  })

  it('maps prospect_created code to draft', () => {
    expect(globalStatusFromWorkflowStatus(ws({ code: 'prospect_created' }))).toBe('draft')
  })

  it('maps medical_review code to medical_review', () => {
    expect(globalStatusFromWorkflowStatus(ws({ code: 'medical_review' }))).toBe('medical_review')
  })

  it('maps need_info code to medical_more_info', () => {
    expect(globalStatusFromWorkflowStatus(ws({ code: 'need_info' }))).toBe('medical_more_info')
  })

  it('maps rejected_medical code to rejected', () => {
    expect(globalStatusFromWorkflowStatus(ws({ code: 'rejected_medical' }))).toBe('rejected')
  })

  it('maps surgery_scheduled code to scheduled', () => {
    expect(globalStatusFromWorkflowStatus(ws({ code: 'surgery_scheduled' }))).toBe('scheduled')
  })

  it('maps validated_medical code to commercial_in_progress', () => {
    expect(globalStatusFromWorkflowStatus(ws({ code: 'validated_medical' }))).toBe(
      'commercial_in_progress'
    )
  })

  it('falls back to draft for unknown code', () => {
    expect(globalStatusFromWorkflowStatus(ws({ code: 'unknown_code' }))).toBe('draft')
  })

  it('uses label fallback when no code', () => {
    expect(globalStatusFromWorkflowStatus(ws({ label: 'En révision médicale' }))).toBe(
      'medical_review'
    )
  })

  it('uses label fallback for commercial', () => {
    expect(globalStatusFromWorkflowStatus(ws({ label: 'Devis en cours' }))).toBe(
      'commercial_in_progress'
    )
  })
})
