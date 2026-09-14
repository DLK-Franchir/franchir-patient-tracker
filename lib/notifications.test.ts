import { describe, expect, it, vi } from 'vitest'

// Le module instancie Resend au chargement (clé API requise) : on le neutralise.
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: vi.fn() }
  },
}))

import { STATUS_NOTIFICATION_RULES } from './notifications'

describe('STATUS_NOTIFICATION_RULES', () => {
  it('notifie la réouverture sur le code DB prospect_created posé par reopen_case', () => {
    const rule = STATUS_NOTIFICATION_RULES.prospect_created
    expect(rule).toBeDefined()
    expect(rule.roles).toEqual(['marcel', 'franchir', 'admin'])
    expect(rule.message('X')).toBe('Le dossier de X a été réouvert.')
  })

  it('ne référence plus le GlobalStatus draft (jamais posé en base)', () => {
    expect(STATUS_NOTIFICATION_RULES).not.toHaveProperty('draft')
  })

  it('notifie la fermeture de dossier (case_closed)', () => {
    const rule = STATUS_NOTIFICATION_RULES.case_closed
    expect(rule).toBeDefined()
    expect(rule.roles).toEqual(['marcel', 'franchir', 'admin'])
    expect(rule.message('X')).toBe('Le dossier de X a été fermé.')
  })

  it('couvre tous les codes DB posés par change-status', () => {
    for (const code of [
      'medical_review',
      'validated_medical',
      'need_info',
      'rejected_medical',
      'surgery_scheduled',
      'prospect_created',
      'case_closed',
    ]) {
      expect(STATUS_NOTIFICATION_RULES[code], code).toBeDefined()
    }
  })
})
