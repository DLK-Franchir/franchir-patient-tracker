import { describe, expect, it } from 'vitest'
import { canAssignSurgeon } from './access-control'
import { canPerformWorkflowAction, getAvailableActions } from './workflow-v2'

describe('canAssignSurgeon', () => {
  it('autorise marcel, franchir et admin (pas Gilles)', () => {
    expect(canAssignSurgeon({ email: 'marcel.mazaltarim@gmail.com', role: 'marcel' })).toBe(true)
    expect(canAssignSurgeon({ email: 'erik.boulard@franchir.eu', role: 'franchir' })).toBe(true)
    expect(canAssignSurgeon({ email: 'duboisgilles31@gmail.com', role: 'gilles' })).toBe(false)
    expect(canAssignSurgeon({ email: 'marcel.mazaltarim@gmail.com', role: 'admin' })).toBe(true)
  })

  it('refuse les profils non staff', () => {
    expect(canAssignSurgeon({ email: 'patient@example.com', role: 'marcel' })).toBe(false)
    expect(canAssignSurgeon(null)).toBe(false)
  })
})

describe('getAvailableActions assign_surgeon', () => {
  it('propose l\'assignation pour marcel en brouillon', () => {
    const actions = getAvailableActions({ globalStatus: 'draft', role: 'marcel' })
    expect(actions.secondaryActions.some((a) => a.id === 'assign_surgeon')).toBe(true)
  })

  it('ne propose pas l\'assignation pour gilles en brouillon', () => {
    const actions = getAvailableActions({ globalStatus: 'draft', role: 'gilles' })
    expect(actions.secondaryActions.some((a) => a.id === 'assign_surgeon')).toBe(false)
  })

  it('ne propose pas l\'assignation pour gilles après validation médicale', () => {
    const actions = getAvailableActions({ globalStatus: 'commercial_in_progress', role: 'gilles' })
    expect(actions.secondaryActions.some((a) => a.id === 'assign_surgeon')).toBe(false)
  })
})

describe('canPerformWorkflowAction', () => {
  it('autorise Gilles sur les actions médicales uniquement', () => {
    expect(canPerformWorkflowAction('gilles', 'approve_medical')).toBe(true)
    expect(canPerformWorkflowAction('gilles', 'request_more_info')).toBe(true)
    expect(canPerformWorkflowAction('gilles', 'reject_medical')).toBe(true)
    expect(canPerformWorkflowAction('gilles', 'assign_surgeon')).toBe(false)
    expect(canPerformWorkflowAction('gilles', 'submit_to_medical')).toBe(false)
  })

  it('autorise admin sur toutes les actions', () => {
    expect(canPerformWorkflowAction('admin', 'approve_medical')).toBe(true)
    expect(canPerformWorkflowAction('admin', 'assign_surgeon')).toBe(true)
    expect(canPerformWorkflowAction('admin', 'submit_to_medical')).toBe(true)
  })
})
