import { describe, expect, it } from 'vitest'
import {
  canPerformWorkflowAction,
  getAvailableActions,
  globalStatusFromWorkflowStatus,
} from './workflow-v2'

describe('case_closed workflow', () => {
  it('mappe le code case_closed vers globalStatus closed', () => {
    expect(
      globalStatusFromWorkflowStatus({ id: '1', code: 'case_closed', label: 'Dossier fermé' }),
    ).toBe('closed')
  })

  it('autorise marcel à fermer un dossier actif', () => {
    expect(canPerformWorkflowAction('marcel', 'close_case', 'commercial_in_progress')).toBe(true)
  })

  it('refuse de fermer un dossier déjà fermé', () => {
    expect(canPerformWorkflowAction('marcel', 'close_case', 'closed')).toBe(false)
  })

  it('bloque les actions workflow sur un dossier fermé sauf réouverture', () => {
    expect(canPerformWorkflowAction('marcel', 'confirm_quote', 'closed')).toBe(false)
    expect(canPerformWorkflowAction('admin', 'reopen_case', 'closed')).toBe(true)
    expect(canPerformWorkflowAction('marcel', 'reopen_case', 'closed')).toBe(true)
  })

  it('expose Fermer le dossier pour marcel sur dossier validé', () => {
    const actions = getAvailableActions({
      globalStatus: 'commercial_in_progress',
      role: 'marcel',
    })
    expect(actions.secondaryActions.some((a) => a.id === 'close_case')).toBe(true)
  })

  it('expose Réouvrir pour admin et marcel sur dossier fermé / refusé', () => {
    expect(getAvailableActions({ globalStatus: 'closed', role: 'admin' }).primaryAction?.id).toBe(
      'reopen_case',
    )
    expect(getAvailableActions({ globalStatus: 'rejected', role: 'marcel' }).primaryAction?.id).toBe(
      'reopen_case',
    )
  })

  it('expose Passer en mode refusé pour marcel en revue médicale', () => {
    const actions = getAvailableActions({ globalStatus: 'medical_review', role: 'marcel' })
    expect(actions.secondaryActions.some((a) => a.id === 'reject_medical')).toBe(true)
  })

  it('expose Passer en mode refusé pour marcel en phase commerciale', () => {
    const actions = getAvailableActions({
      globalStatus: 'commercial_in_progress',
      role: 'marcel',
      quoteAccepted: false,
      dateAccepted: false,
    })
    expect(actions.secondaryActions.some((a) => a.id === 'reject_medical')).toBe(true)
    expect(actions.secondaryActions.some((a) => a.id === 'close_case')).toBe(true)
  })

  it('mappe validated_medical vers commercial_in_progress', () => {
    expect(
      globalStatusFromWorkflowStatus({
        id: '1',
        code: 'validated_medical',
        label: 'Validé médicalement',
      }),
    ).toBe('commercial_in_progress')
  })
})
