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

  it('bloque les actions workflow sur un dossier fermé sauf réouverture admin', () => {
    expect(canPerformWorkflowAction('marcel', 'confirm_quote', 'closed')).toBe(false)
    expect(canPerformWorkflowAction('admin', 'reopen_case', 'closed')).toBe(true)
  })

  it('expose Fermer le dossier pour marcel sur dossier validé', () => {
    const actions = getAvailableActions({
      globalStatus: 'commercial_in_progress',
      role: 'marcel',
    })
    expect(actions.secondaryActions.some((a) => a.id === 'close_case')).toBe(true)
  })

  it('expose Réouvrir pour admin sur dossier fermé', () => {
    const actions = getAvailableActions({ globalStatus: 'closed', role: 'admin' })
    expect(actions.primaryAction?.id).toBe('reopen_case')
  })
})
