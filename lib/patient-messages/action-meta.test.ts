import { describe, expect, it } from 'vitest'
import {
  buildCommercialDataEditMeta,
  buildDocumentDeletedMeta,
  buildQuestionnaireCompletedMeta,
  buildSummaryEditMeta,
  buildWorkflowActionMeta,
  hasReason,
  refusalKindForRole,
  toIsoDateOrNull,
  toNumberOrNull,
} from './action-meta'

describe('refusalKindForRole', () => {
  it('gilles → refus médical', () => {
    expect(refusalKindForRole('gilles')).toBe('medical')
  })

  it('marcel / franchir / admin → refus administratif', () => {
    expect(refusalKindForRole('marcel')).toBe('administrative')
    expect(refusalKindForRole('franchir')).toBe('administrative')
    expect(refusalKindForRole('admin')).toBe('administrative')
  })
})

describe('helpers de normalisation', () => {
  it('hasReason ne retient que les chaînes non vides', () => {
    expect(hasReason('Motif')).toBe(true)
    expect(hasReason('   ')).toBe(false)
    expect(hasReason(undefined)).toBe(false)
    expect(hasReason(null)).toBe(false)
    expect(hasReason(12)).toBe(false)
  })

  it('toNumberOrNull parse nombres et chaînes numériques', () => {
    expect(toNumberOrNull(12000)).toBe(12000)
    expect(toNumberOrNull('12000')).toBe(12000)
    expect(toNumberOrNull('12,5')).toBe(12.5)
    expect(toNumberOrNull('')).toBeNull()
    expect(toNumberOrNull(null)).toBeNull()
    expect(toNumberOrNull('abc')).toBeNull()
  })

  it('toIsoDateOrNull normalise en ISO', () => {
    expect(toIsoDateOrNull('2026-10-01')).toBe('2026-10-01T00:00:00.000Z')
    expect(toIsoDateOrNull('2026-10-01T00:00:00+00:00')).toBe('2026-10-01T00:00:00.000Z')
    expect(toIsoDateOrNull('pas une date')).toBeNull()
    expect(toIsoDateOrNull(null)).toBeNull()
  })
})

describe('buildWorkflowActionMeta', () => {
  it('pose old/new status uniquement en cas de transition', () => {
    const withTransition = buildWorkflowActionMeta({
      actionId: 'submit_to_medical',
      role: 'marcel',
      oldStatusCode: 'prospect_created',
      newStatusCode: 'medical_review',
    })
    expect(withTransition).toEqual({
      action_id: 'submit_to_medical',
      old_status: 'prospect_created',
      new_status: 'medical_review',
    })

    const noTransition = buildWorkflowActionMeta({ actionId: 'confirm_quote', role: 'marcel' })
    expect(noTransition).not.toHaveProperty('old_status')
    expect(noTransition).not.toHaveProperty('new_status')
  })

  it('assign_surgeon trace le nouveau et l’ancien chirurgien', () => {
    expect(
      buildWorkflowActionMeta({
        actionId: 'assign_surgeon',
        role: 'franchir',
        previousSurgeonId: 'surg-old',
        assignedSurgeonId: 'surg-new',
      }),
    ).toEqual({
      action_id: 'assign_surgeon',
      surgeon_id: 'surg-new',
      previous_surgeon_id: 'surg-old',
    })
  })

  it('approve_medical trace les recommandations et l’assignation optionnelle', () => {
    const noAssign = buildWorkflowActionMeta({
      actionId: 'approve_medical',
      role: 'gilles',
      oldStatusCode: 'medical_review',
      newStatusCode: 'validated_medical',
      recommendedSurgeonIds: ['a', 'b'],
    })
    expect(noAssign.recommended_surgeon_ids).toEqual(['a', 'b'])
    expect(noAssign).not.toHaveProperty('surgeon_id')

    const withAssign = buildWorkflowActionMeta({
      actionId: 'approve_medical',
      role: 'gilles',
      oldStatusCode: 'medical_review',
      newStatusCode: 'validated_medical',
      recommendedSurgeonIds: ['a'],
      assignedSurgeonId: 'a',
      previousSurgeonId: null,
    })
    expect(withAssign.surgeon_id).toBe('a')
    expect(withAssign.previous_surgeon_id).toBeNull()
  })

  it('add_budget / propose_dates tracent la valeur et la précédente', () => {
    expect(
      buildWorkflowActionMeta({
        actionId: 'add_budget',
        role: 'franchir',
        previousQuoteAmount: null,
        quoteAmount: 15000,
      }),
    ).toEqual({ action_id: 'add_budget', quote_amount: 15000, previous_quote_amount: null })

    expect(
      buildWorkflowActionMeta({
        actionId: 'propose_dates',
        role: 'franchir',
        previousProposedDate: '2026-09-01T00:00:00.000Z',
        proposedDate: '2026-10-01T00:00:00.000Z',
      }),
    ).toEqual({
      action_id: 'propose_dates',
      proposed_date: '2026-10-01T00:00:00.000Z',
      previous_proposed_date: '2026-09-01T00:00:00.000Z',
    })
  })

  it('confirm_quote / confirm_date tracent la valeur courante', () => {
    expect(
      buildWorkflowActionMeta({ actionId: 'confirm_quote', role: 'marcel', quoteAmount: '9800' }),
    ).toEqual({ action_id: 'confirm_quote', quote_amount: 9800 })

    expect(
      buildWorkflowActionMeta({
        actionId: 'confirm_date',
        role: 'marcel',
        proposedDate: '2026-10-01T00:00:00+00:00',
        newStatusCode: 'surgery_scheduled',
        oldStatusCode: 'validated_medical',
      }),
    ).toMatchObject({
      action_id: 'confirm_date',
      proposed_date: '2026-10-01T00:00:00.000Z',
      new_status: 'surgery_scheduled',
    })
  })

  it('ne copie jamais le motif dans meta, seulement sa présence', () => {
    const meta = buildWorkflowActionMeta({
      actionId: 'request_more_info',
      role: 'gilles',
      oldStatusCode: 'medical_review',
      newStatusCode: 'need_info',
      reason: 'IRM manquante',
    })
    expect(meta.has_reason).toBe(true)
    expect(JSON.stringify(meta)).not.toContain('IRM manquante')

    expect(
      buildWorkflowActionMeta({ actionId: 'close_case', role: 'marcel', newStatusCode: 'case_closed' })
        .has_reason,
    ).toBe(false)
    expect(
      buildWorkflowActionMeta({
        actionId: 'reopen_case',
        role: 'admin',
        newStatusCode: 'prospect_created',
        reason: 'Nouveaux éléments',
      }).has_reason,
    ).toBe(true)
  })

  it('reject_medical distingue refus médical (gilles) et administratif (marcel)', () => {
    const byGilles = buildWorkflowActionMeta({
      actionId: 'reject_medical',
      role: 'gilles',
      oldStatusCode: 'medical_review',
      newStatusCode: 'rejected_medical',
      reason: 'Contre-indication',
    })
    expect(byGilles).toEqual({
      action_id: 'reject_medical',
      old_status: 'medical_review',
      new_status: 'rejected_medical',
      has_reason: true,
      refusal_kind: 'medical',
    })

    const byMarcel = buildWorkflowActionMeta({
      actionId: 'reject_medical',
      role: 'marcel',
      oldStatusCode: 'validated_medical',
      newStatusCode: 'rejected_medical',
    })
    expect(byMarcel.refusal_kind).toBe('administrative')
    expect(byMarcel.has_reason).toBe(false)
  })
})

describe('buildCommercialDataEditMeta', () => {
  it('retourne null si rien ne change', () => {
    expect(
      buildCommercialDataEditMeta(
        { quote_amount: 12000, proposed_date: '2026-10-01T00:00:00+00:00' },
        { quote_amount: '12000', proposed_date: '2026-10-01' },
      ),
    ).toBeNull()
  })

  it('ignore les champs non envoyés', () => {
    const edit = buildCommercialDataEditMeta(
      { quote_amount: 12000, proposed_date: '2026-10-01T00:00:00+00:00' },
      { quote_amount: 13000 },
    )
    expect(edit?.fieldsChanged).toEqual(['quote_amount'])
    expect(edit?.meta).toEqual({
      action_id: 'edit_commercial_data',
      previous_quote_amount: 12000,
      quote_amount: 13000,
      fields_changed: ['quote_amount'],
    })
  })

  it('trace les deux champs quand ils changent (dont mise à null)', () => {
    const edit = buildCommercialDataEditMeta(
      { quote_amount: 12000, proposed_date: '2026-10-01T00:00:00+00:00' },
      { quote_amount: null, proposed_date: '2026-11-15' },
    )
    expect(edit?.fieldsChanged).toEqual(['quote_amount', 'proposed_date'])
    expect(edit?.meta).toMatchObject({
      previous_quote_amount: 12000,
      quote_amount: null,
      previous_proposed_date: '2026-10-01T00:00:00.000Z',
      proposed_date: '2026-11-15T00:00:00.000Z',
    })
  })
})

describe('buildSummaryEditMeta', () => {
  it('retourne null si les textes sont identiques (espaces ignorés)', () => {
    expect(
      buildSummaryEditMeta(
        { clinical_summary: 'Résumé', sharepoint_link: 'https://x' },
        { clinical_summary: ' Résumé ', sharepoint_link: 'https://x' },
      ),
    ).toBeNull()
  })

  it('ne trace que les noms de champs, jamais le contenu clinique', () => {
    const edit = buildSummaryEditMeta(
      { clinical_summary: 'Ancien résumé', sharepoint_link: null },
      { clinical_summary: 'Nouveau résumé confidentiel', sharepoint_link: 'https://sp' },
    )
    expect(edit?.fieldsChanged).toEqual(['clinical_summary', 'sharepoint_link'])
    expect(edit?.meta).toEqual({
      action_id: 'edit_summary',
      fields_changed: ['clinical_summary', 'sharepoint_link'],
    })
    expect(JSON.stringify(edit?.meta)).not.toContain('confidentiel')
  })

  it('ignore un champ non envoyé', () => {
    const edit = buildSummaryEditMeta(
      { clinical_summary: 'A', sharepoint_link: 'https://x' },
      { sharepoint_link: 'https://y' },
    )
    expect(edit?.fieldsChanged).toEqual(['sharepoint_link'])
  })
})

describe('buildDocumentDeletedMeta', () => {
  it('trace identifiant, kind et taille sans nom de fichier', () => {
    expect(
      buildDocumentDeletedMeta({ id: 'doc-1', kind: 'dicom', size_bytes: '2048' }),
    ).toEqual({ action_id: 'document_deleted', document_id: 'doc-1', kind: 'dicom', size_bytes: 2048 })
    expect(buildDocumentDeletedMeta({ id: 'doc-2', kind: 'autre', size_bytes: null }).kind).toBe(
      'document',
    )
  })
})

describe('buildQuestionnaireCompletedMeta', () => {
  it('trace la date et la présence du résumé, pas son contenu', () => {
    const meta = buildQuestionnaireCompletedMeta({
      completedAt: '2026-09-14T10:00:00.000Z',
      summary: 'Résumé clinique sensible',
    })
    expect(meta).toEqual({
      action_id: 'questionnaire_completed',
      completed_at: '2026-09-14T10:00:00.000Z',
      has_summary: true,
    })
    expect(
      buildQuestionnaireCompletedMeta({ completedAt: '2026-09-14T10:00:00.000Z', summary: null })
        .has_summary,
    ).toBe(false)
  })
})
