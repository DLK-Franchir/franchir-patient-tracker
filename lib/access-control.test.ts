import { describe, expect, it } from 'vitest'
import { canAssignSurgeon } from './access-control'
import { getAvailableActions } from './workflow-v2'

describe('canAssignSurgeon', () => {
  it('autorise marcel, franchir, gilles et admin', () => {
    expect(canAssignSurgeon({ email: 'marcel.mazaltarim@gmail.com', role: 'marcel' })).toBe(true)
    expect(canAssignSurgeon({ email: 'erik.boulard@franchir.eu', role: 'franchir' })).toBe(true)
    expect(canAssignSurgeon({ email: 'duboisgilles31@gmail.com', role: 'gilles' })).toBe(true)
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
})
