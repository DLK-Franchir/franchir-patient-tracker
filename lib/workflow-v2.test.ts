import { afterEach, describe, expect, it, vi } from 'vitest'
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

  it('expose Passer en mode refusé pour marcel/admin sur tout dossier non terminal', () => {
    for (const globalStatus of [
      'draft',
      'medical_review',
      'medical_more_info',
      'commercial_in_progress',
      'scheduled',
    ] as const) {
      for (const role of ['marcel', 'admin'] as const) {
        const actions = getAvailableActions({ globalStatus, role })
        const hasRefuse =
          actions.primaryAction?.id === 'reject_medical' ||
          actions.secondaryActions.some((a) => a.id === 'reject_medical')
        expect(hasRefuse).toBe(true)
      }
    }
  })

  it('n’expose pas le refus sur dossier refusé/fermé (réouverture à la place)', () => {
    for (const globalStatus of ['rejected', 'closed'] as const) {
      const actions = getAvailableActions({ globalStatus, role: 'marcel' })
      expect(actions.primaryAction?.id).toBe('reopen_case')
      expect(actions.secondaryActions.some((a) => a.id === 'reject_medical')).toBe(false)
    }
  })

  it('désactive Confirmer le devis/date tant que les valeurs ne sont pas saisies', () => {
    const actions = getAvailableActions({
      globalStatus: 'commercial_in_progress',
      role: 'marcel',
      quoteAccepted: false,
      dateAccepted: false,
      hasQuoteAmount: false,
      hasProposedDate: false,
    })
    expect(actions.primaryAction?.id).toBe('confirm_quote')
    expect(actions.primaryAction?.disabled).toBe(true)
    expect(actions.primaryAction?.disabledReason).toMatch(/devis/i)
    const confirmDate = actions.secondaryActions.find((a) => a.id === 'confirm_date')
    expect(confirmDate?.disabled).toBe(true)
    expect(confirmDate?.disabledReason).toMatch(/date/i)
  })

  it('active Confirmer le devis/date une fois les valeurs présentes', () => {
    const actions = getAvailableActions({
      globalStatus: 'commercial_in_progress',
      role: 'marcel',
      quoteAccepted: false,
      dateAccepted: false,
      hasQuoteAmount: true,
      hasProposedDate: true,
    })
    expect(actions.primaryAction?.id).toBe('confirm_quote')
    expect(actions.primaryAction?.disabled).toBeFalsy()
    const confirmDate = actions.secondaryActions.find((a) => a.id === 'confirm_date')
    expect(confirmDate?.disabled).toBeFalsy()
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

describe('codes workflow_statuses présents en base mais non produits par l’application', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const PROD_ONLY_CODES = [
    { code: 'quote_issued', label: 'Devis envoyé', expected: 'commercial_in_progress' },
    { code: 'quote_accepted', label: 'Devis accepté', expected: 'commercial_in_progress' },
    { code: 'surgery_done', label: 'Chirurgie effectuée', expected: 'scheduled' },
    { code: 'completed', label: 'Dossier terminé', expected: 'closed' },
  ] as const

  it.each(PROD_ONLY_CODES)('mappe $code (« $label ») vers $expected', ({ code, label, expected }) => {
    expect(globalStatusFromWorkflowStatus({ id: '1', code, label })).toBe(expected)
  })

  it('mappe surgery_done vers scheduled et non commercial_in_progress (ancien fallback « chirurgie »)', () => {
    expect(
      globalStatusFromWorkflowStatus({ id: '1', code: 'surgery_done', label: 'Chirurgie effectuée' }),
    ).not.toBe('commercial_in_progress')
  })

  it('mappe completed vers closed et non draft (ancien fallback « dossier »)', () => {
    expect(
      globalStatusFromWorkflowStatus({ id: '1', code: 'completed', label: 'Dossier terminé' }),
    ).not.toBe('draft')
  })

  it.each(PROD_ONLY_CODES)(
    'résout $code par le code seul, sans solliciter le fallback libellé',
    ({ code, expected }) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      // Libellé trompeur : le fallback libellé donnerait un autre GlobalStatus.
      expect(globalStatusFromWorkflowStatus({ id: '1', code, label: 'Refusé' })).toBe(expected)
      // Sans libellé : le fallback tomberait sur draft + console.warn.
      expect(globalStatusFromWorkflowStatus({ id: '1', code })).toBe(expected)
      expect(warn).not.toHaveBeenCalled()
    },
  )

  it('n’altère pas le mapping des codes produits par l’application', () => {
    const cases = [
      ['prospect_created', 'draft'],
      ['medical_review', 'medical_review'],
      ['need_info', 'medical_more_info'],
      ['validated_medical', 'commercial_in_progress'],
      ['surgery_scheduled', 'scheduled'],
      ['case_closed', 'closed'],
      ['rejected_medical', 'rejected'],
    ] as const
    for (const [code, expected] of cases) {
      expect(globalStatusFromWorkflowStatus({ id: '1', code })).toBe(expected)
    }
  })
})
