import { describe, it, expect } from 'vitest'
import {
  canRolePerformWorkflowAction,
  canRolePerformWorkflowActionResult,
  canPerformAction,
} from '../lib/domain/patients/workflow'
import type { WorkflowPermissionContext, PatientPermissionContext } from '../lib/domain/patients/types'

describe('canRolePerformWorkflowAction', () => {
  it('allows marcel to submit_to_medical when draft', () => {
    const ctx: WorkflowPermissionContext = {
      role: 'marcel',
      actionId: 'submit_to_medical',
      globalStatus: 'draft',
    }
    expect(canRolePerformWorkflowAction(ctx)).toBe(true)
  })

  it('denies gilles to submit_to_medical when draft', () => {
    const ctx: WorkflowPermissionContext = {
      role: 'gilles',
      actionId: 'submit_to_medical',
      globalStatus: 'draft',
    }
    expect(canRolePerformWorkflowAction(ctx)).toBe(false)
  })

  it('allows gilles to approve_medical when medical_review', () => {
    const ctx: WorkflowPermissionContext = {
      role: 'gilles',
      actionId: 'approve_medical',
      globalStatus: 'medical_review',
    }
    expect(canRolePerformWorkflowAction(ctx)).toBe(true)
  })

  it('denies marcel to approve_medical when medical_review', () => {
    const ctx: WorkflowPermissionContext = {
      role: 'marcel',
      actionId: 'approve_medical',
      globalStatus: 'medical_review',
    }
    expect(canRolePerformWorkflowAction(ctx)).toBe(false)
  })

  it('allows admin to reopen_case when rejected', () => {
    const ctx: WorkflowPermissionContext = {
      role: 'admin',
      actionId: 'reopen_case',
      globalStatus: 'rejected',
    }
    expect(canRolePerformWorkflowAction(ctx)).toBe(true)
  })

  it('denies non-admin to reopen_case when rejected', () => {
    const ctx: WorkflowPermissionContext = {
      role: 'marcel',
      actionId: 'reopen_case',
      globalStatus: 'rejected',
    }
    expect(canRolePerformWorkflowAction(ctx)).toBe(false)
  })

  it('denies reopen_case when not rejected', () => {
    const ctx: WorkflowPermissionContext = {
      role: 'admin',
      actionId: 'reopen_case',
      globalStatus: 'draft',
    }
    expect(canRolePerformWorkflowAction(ctx)).toBe(false)
  })

  it('allows franchir to add_budget when commercial_in_progress', () => {
    const ctx: WorkflowPermissionContext = {
      role: 'franchir',
      actionId: 'add_budget',
      globalStatus: 'commercial_in_progress',
    }
    expect(canRolePerformWorkflowAction(ctx)).toBe(true)
  })

  it('denies marcel to add_budget when commercial_in_progress', () => {
    const ctx: WorkflowPermissionContext = {
      role: 'marcel',
      actionId: 'add_budget',
      globalStatus: 'commercial_in_progress',
    }
    expect(canRolePerformWorkflowAction(ctx)).toBe(false)
  })

  it('denies confirm_quote when already quoteAccepted', () => {
    const ctx: WorkflowPermissionContext = {
      role: 'marcel',
      actionId: 'confirm_quote',
      globalStatus: 'commercial_in_progress',
      quoteAccepted: true,
    }
    expect(canRolePerformWorkflowAction(ctx)).toBe(false)
  })

  it('allows confirm_quote when not quoteAccepted', () => {
    const ctx: WorkflowPermissionContext = {
      role: 'marcel',
      actionId: 'confirm_quote',
      globalStatus: 'commercial_in_progress',
      quoteAccepted: false,
    }
    expect(canRolePerformWorkflowAction(ctx)).toBe(true)
  })

  it('denies confirm_date when already dateAccepted', () => {
    const ctx: WorkflowPermissionContext = {
      role: 'marcel',
      actionId: 'confirm_date',
      globalStatus: 'commercial_in_progress',
      dateAccepted: true,
    }
    expect(canRolePerformWorkflowAction(ctx)).toBe(false)
  })

  it('allows resubmit_to_medical when medical_more_info', () => {
    const ctx: WorkflowPermissionContext = {
      role: 'marcel',
      actionId: 'resubmit_to_medical',
      globalStatus: 'medical_more_info',
    }
    expect(canRolePerformWorkflowAction(ctx)).toBe(true)
  })
})

describe('canRolePerformWorkflowActionResult reason', () => {
  it('returns reason when denied', () => {
    const ctx: WorkflowPermissionContext = {
      role: 'gilles',
      actionId: 'submit_to_medical',
      globalStatus: 'draft',
    }
    const result = canRolePerformWorkflowActionResult(ctx)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBeTruthy()
  })

  it('returns no reason when allowed', () => {
    const ctx: WorkflowPermissionContext = {
      role: 'marcel',
      actionId: 'submit_to_medical',
      globalStatus: 'draft',
    }
    const result = canRolePerformWorkflowActionResult(ctx)
    expect(result.allowed).toBe(true)
    expect(result.reason).toBeUndefined()
  })
})

describe('canPerformAction — patient-level permissions', () => {
  it('allows marcel to create_patient', () => {
    const ctx: PatientPermissionContext = { role: 'marcel', actionId: 'create_patient' }
    expect(canPerformAction(ctx).allowed).toBe(true)
  })

  it('denies gilles to create_patient', () => {
    const ctx: PatientPermissionContext = { role: 'gilles', actionId: 'create_patient' }
    expect(canPerformAction(ctx).allowed).toBe(false)
  })

  it('denies edit_patient_summary when rejected and not admin', () => {
    const ctx: PatientPermissionContext = {
      role: 'marcel',
      actionId: 'edit_patient_summary',
      globalStatus: 'rejected',
    }
    expect(canPerformAction(ctx).allowed).toBe(false)
  })

  it('allows admin to edit_patient_summary even when rejected', () => {
    const ctx: PatientPermissionContext = {
      role: 'admin',
      actionId: 'edit_patient_summary',
      globalStatus: 'rejected',
    }
    expect(canPerformAction(ctx).allowed).toBe(true)
  })

  it('allows any role to post_message (not rejected)', () => {
    const roles = ['marcel', 'gilles', 'franchir', 'admin'] as const
    for (const role of roles) {
      const ctx: PatientPermissionContext = {
        role,
        actionId: 'post_message',
        globalStatus: 'draft',
      }
      expect(canPerformAction(ctx).allowed).toBe(true)
    }
  })

  it('denies post_message when rejected and not admin', () => {
    const ctx: PatientPermissionContext = {
      role: 'marcel',
      actionId: 'post_message',
      globalStatus: 'rejected',
    }
    expect(canPerformAction(ctx).allowed).toBe(false)
  })

  it('allows admin to post_message even when rejected', () => {
    const ctx: PatientPermissionContext = {
      role: 'admin',
      actionId: 'post_message',
      globalStatus: 'rejected',
    }
    expect(canPerformAction(ctx).allowed).toBe(true)
  })

  it('returns fieldsLocked when denied edit_commercial_data for gilles', () => {
    const ctx: PatientPermissionContext = {
      role: 'gilles',
      actionId: 'edit_commercial_data',
      globalStatus: 'commercial_in_progress',
    }
    const result = canPerformAction(ctx)
    expect(result.allowed).toBe(false)
    expect(result.fieldsLocked).toContain('commercial_data')
  })
})
