import { describe, expect, it } from 'vitest'
import {
  computeDashboardSummary,
  filterPatientsForRole,
  formatMineBreakdown,
  getDefaultDashboardTab,
  getEffectiveDashboardTab,
  getGillesDashboardLandingRedirect,
  getGillesPriorityMessage,
  hasExplicitDashboardListFilter,
  isDashboardShowAllScope,
  normalizeDashboardKpiForRole,
  normalizeDashboardTabForRole,
  getFocusPatientIds,
  hadRoleInvalidatedListFilter,
  getPipelinePatientIds,
  getPriorityBannerContent,
  getRoleScopedPatientIds,
  getShortPendingActionLabel,
  globalStatusToDbCodes,
  intersectPatientIds,
  isMinePatient,
  isRoleScopedPatient,
  isWaitingPatient,
  mineActionShortLabel,
  pendingActionLabel,
  PIPELINE_GLOBAL_STATUSES,
  resolveDashboardListFilterIds,
} from './dashboard-summary'

const patient = (id: string, code: string) => ({
  id,
  workflow_statuses: { id: `ws-${code}`, code, label: code },
})

describe('dashboard-summary', () => {
  it('compte les dossiers par statut global et les actions marcel', () => {
    const patients = [
      patient('1', 'draft'),
      patient('2', 'medical_review'),
      patient('3', 'case_closed'),
      patient('4', 'need_info'),
    ]

    const summary = computeDashboardSummary(patients, 'marcel')

    expect(summary.mine).toBe(2)
    expect(summary.waiting).toBe(1)
    expect(summary.closed).toBe(1)
    expect(summary.totalActive).toBe(3)
    expect(summary.byGlobalStatus.draft).toBe(1)
    expect(summary.byGlobalStatus.medical_review).toBe(1)
    expect(summary.byGlobalStatus.medical_more_info).toBe(1)
    expect(summary.byGlobalStatus.closed).toBe(1)
    expect(summary.mineBreakdown).toEqual([
      { globalStatus: 'draft', count: 1 },
      { globalStatus: 'medical_more_info', count: 1 },
    ])
  })

  it('identifie les dossiers gilles en revue médicale comme "mine"', () => {
    const p = patient('g1', 'medical_review')
    expect(isMinePatient(p, 'gilles')).toBe(true)
    expect(isWaitingPatient(p, 'marcel')).toBe(true)
    expect(pendingActionLabel('medical_review', 'gilles')).toContain('Examinez')
  })

  it('filtre les ids focus mine', () => {
    const patients = [
      patient('1', 'draft'),
      patient('2', 'medical_review'),
      patient('3', 'case_closed'),
    ]

    const mineIds = getFocusPatientIds(patients, 'marcel', 'mine')

    expect(mineIds).toEqual(['1'])
    expect(getFocusPatientIds(patients, 'marcel', 'all')).toBeNull()
  })

  it('filtre pipeline brouillon avec prospect_created', () => {
    const patients = [
      patient('1', 'prospect_created'),
      patient('2', 'medical_review'),
      patient('3', 'draft'),
    ]

    const draftIds = getPipelinePatientIds(patients, 'draft')

    expect(draftIds).toEqual(['1', '3'])
    expect(globalStatusToDbCodes('draft')).toContain('prospect_created')
  })

  it('mappe les codes DB pour filtrage pipeline', () => {
    expect(globalStatusToDbCodes('draft')).toContain('draft')
    expect(globalStatusToDbCodes('closed')).toContain('case_closed')
  })

  it('ventile mineBreakdown pour admin avec plusieurs types d\'action', () => {
    const patients = [
      ...Array.from({ length: 8 }, (_, i) => patient(`c${i}`, 'validated_medical')),
      ...Array.from({ length: 3 }, (_, i) => patient(`d${i}`, 'draft')),
      ...Array.from({ length: 5 }, (_, i) => patient(`s${i}`, 'surgery_scheduled')),
    ]

    const summary = computeDashboardSummary(patients, 'admin')

    expect(summary.mine).toBe(11)
    expect(summary.totalActive).toBe(16)
    expect(summary.mineBreakdown).toEqual([
      { globalStatus: 'commercial_in_progress', count: 8 },
      { globalStatus: 'draft', count: 3 },
    ])
    expect(formatMineBreakdown(summary.mineBreakdown, 'admin')).toBe(
      '8 devis à confirmer · 3 à soumettre',
    )
  })

  it('bandeau : total actif + ventilation mine (pas guidance unique sur tout le total)', () => {
    const patients = [
      ...Array.from({ length: 8 }, (_, i) => patient(`c${i}`, 'commercial')),
      ...Array.from({ length: 3 }, (_, i) => patient(`d${i}`, 'draft')),
      ...Array.from({ length: 5 }, (_, i) => patient(`s${i}`, 'surgery_scheduled')),
    ]

    const summary = computeDashboardSummary(patients, 'admin')
    const banner = getPriorityBannerContent(summary, 'admin')

    expect(banner).not.toBeNull()
    expect(banner?.title).toBe('16 dossiers actifs')
    expect(banner?.subtitle).toContain('11 dossiers vous attendent')
    expect(banner?.subtitle).toContain('8 devis à confirmer')
    expect(banner?.subtitle).toContain('3 à soumettre')
    expect(banner?.subtitle).not.toContain('Confirmez le devis et la date proposée pour finaliser le dossier.')
    expect(banner?.variant).toBe('action')
    expect(banner?.globalStatus).toBe('commercial_in_progress')
  })

  it('bandeau neutre quand mine === 0 (même avec dossiers commerciaux en attente)', () => {
    const patients = Array.from({ length: 14 }, (_, i) => patient(`c${i}`, 'validated_medical'))

    const summary = computeDashboardSummary(patients, 'gilles')

    expect(summary.mine).toBe(0)
    expect(summary.waiting).toBe(14)

    const banner = getPriorityBannerContent(summary, 'gilles')

    expect(banner?.title).toBe('14 dossiers actifs')
    expect(banner?.subtitle).toContain('Aucune action requise de votre part')
    expect(banner?.subtitle).toContain('14 dossiers en cours chez d\'autres intervenants')
    expect(banner?.variant).toBe('neutral')
    expect(banner?.subtitle).not.toContain('Confirmez le devis')
  })

  it('bandeau : guidance unique quand un seul type d\'action mine', () => {
    const patients = Array.from({ length: 3 }, (_, i) => patient(`d${i}`, 'draft'))
    const summary = computeDashboardSummary(patients, 'marcel')
    const banner = getPriorityBannerContent(summary, 'marcel')

    expect(banner?.subtitle).toContain('3 dossiers vous attendent')
    expect(banner?.subtitle).toContain('Soumettez ce dossier à la validation médicale')
    expect(mineActionShortLabel('draft', 'marcel')).toBe('à soumettre')
  })

  it('aligne les compteurs chips pipeline avec getPipelinePatientIds', () => {
    const patients = [
      patient('1', 'prospect_created'),
      patient('2', 'medical_review'),
      patient('3', 'need_info'),
      patient('4', 'validated_medical'),
      patient('5', 'surgery_scheduled'),
      patient('6', 'rejected_medical'),
      patient('7', 'case_closed'),
    ]

    const summary = computeDashboardSummary(patients, 'marcel')

    for (const globalStatus of PIPELINE_GLOBAL_STATUSES) {
      const ids = getPipelinePatientIds(patients, globalStatus)
      expect(ids.length).toBe(summary.byGlobalStatus[globalStatus])
    }

    expect(getFocusPatientIds(patients, 'marcel', 'mine')?.length).toBe(summary.mine)
  })

  it('libellés courts action en attente pour le tableau', () => {
    expect(getShortPendingActionLabel('draft', 'marcel')).toBe('Soumettre au médical')
    expect(getShortPendingActionLabel('medical_review', 'gilles')).toBe('Revue médicale')
    expect(getShortPendingActionLabel('medical_more_info', 'marcel')).toBe('Compléter dossier')
    expect(getShortPendingActionLabel('commercial_in_progress', 'marcel')).toBe('Confirmer devis/date')
    expect(getShortPendingActionLabel('commercial_in_progress', 'franchir')).toBe('Gérer devis/dates')
    expect(getShortPendingActionLabel('medical_review', 'marcel')).toBeNull()
    expect(getShortPendingActionLabel('commercial_in_progress', 'gilles')).toBeNull()
  })

  it('restreint la vue Gilles aux dossiers médicaux et suivi post-validation', () => {
    const patients = [
      patient('1', 'draft'),
      patient('2', 'medical_review'),
      patient('3', 'validated_medical'),
      patient('4', 'surgery_scheduled'),
      patient('5', 'case_closed'),
      patient('6', 'prospect_created'),
      patient('7', 'rejected_medical'),
    ]

    const scoped = filterPatientsForRole(patients, 'gilles')

    expect(scoped.map((p) => p.id)).toEqual(['2', '3', '4', '7'])
    expect(getRoleScopedPatientIds(patients, 'marcel')).toBeNull()
    expect(getDefaultDashboardTab('gilles', computeDashboardSummary(scoped, 'gilles'))).toBe(
      'revue',
    )
    expect(
      intersectPatientIds(['2', '3'], getRoleScopedPatientIds(patients, 'gilles')),
    ).toEqual(['2', '3'])
    expect(isRoleScopedPatient(patient('1', 'draft'), 'gilles')).toBe(false)
    expect(isRoleScopedPatient(patient('3', 'validated_medical'), 'gilles')).toBe(true)
  })

  it('ignore les filtres URL invalides pour Gilles', () => {
    expect(normalizeDashboardTabForRole('actifs', 'gilles')).toBeNull()
    expect(normalizeDashboardKpiForRole('toConfirm', 'gilles')).toBeNull()
    expect(normalizeDashboardTabForRole('revue', 'gilles')).toBe('revue')
    expect(hadRoleInvalidatedListFilter({ tab: 'actifs' }, 'gilles')).toBe(true)
    expect(hadRoleInvalidatedListFilter({ kpi: 'toConfirm' }, 'gilles')).toBe(true)
    expect(hadRoleInvalidatedListFilter({ tab: 'revue' }, 'gilles')).toBe(false)
    expect(hadRoleInvalidatedListFilter({ tab: 'actifs' }, 'marcel')).toBe(false)
  })

  it('détecte un filtre explicite dans l\'URL du dashboard', () => {
    expect(hasExplicitDashboardListFilter({})).toBe(false)
    expect(hasExplicitDashboardListFilter({ focus: 'mine' })).toBe(true)
    expect(hasExplicitDashboardListFilter({ tab: 'revue' })).toBe(true)
    expect(hasExplicitDashboardListFilter({ kpi: 'revue' })).toBe(true)
    expect(hasExplicitDashboardListFilter({ status: 'medical_review' })).toBe(true)
    expect(hasExplicitDashboardListFilter({ all: '1' })).toBe(true)
  })

  it('filtre la liste via kpi=revue même sans tab explicite', () => {
    const patients = [
      patient('1', 'medical_review'),
      patient('2', 'validated_medical'),
      patient('3', 'medical_review'),
    ]
    const scoped = filterPatientsForRole(patients, 'gilles')

    const ids = resolveDashboardListFilterIds(scoped, 'gilles', {
      focus: 'all',
      activeTab: null,
      activeKpi: 'revue',
      pipelineGlobalStatus: null,
    })

    expect(ids).toEqual(['1', '3'])
  })

  it('all=1 affiche tout le périmètre Gilles sans filtrer par tab résiduel', () => {
    expect(isDashboardShowAllScope({ all: '1' })).toBe(true)

    const patients = [
      patient('1', 'medical_review'),
      patient('2', 'validated_medical'),
    ]
    const scoped = filterPatientsForRole(patients, 'gilles')
    const filtered = resolveDashboardListFilterIds(scoped, 'gilles', {
      focus: 'all',
      activeTab: 'revue',
      activeKpi: null,
      pipelineGlobalStatus: null,
    })

    expect(filtered).toEqual(['1'])
    expect(scoped.map((p) => p.id)).toEqual(['1', '2'])
  })

  it('message prioritaire Gilles pour les revues en attente', () => {
    const patients = [patient('1', 'medical_review'), patient('2', 'medical_review')]
    const summary = computeDashboardSummary(filterPatientsForRole(patients, 'gilles'), 'gilles')
    expect(getGillesPriorityMessage(summary)).toBe('Vous avez 2 revues médicales à traiter.')
  })

  it('onglet effectif uniquement via tab ou kpi URL', () => {
    expect(getEffectiveDashboardTab('revue', null)).toBe('revue')
    expect(getEffectiveDashboardTab(null, 'revue')).toBe('revue')
    expect(getEffectiveDashboardTab(null, null)).toBeNull()
    expect(getEffectiveDashboardTab('commercial', 'revue')).toBe('commercial')
  })

  it('redirige Gilles vers all=1 sur landing sans filtre explicite', () => {
    const patients = [
      patient('1', 'medical_review'),
      patient('2', 'validated_medical'),
      patient('3', 'validated_medical'),
    ]
    const scoped = filterPatientsForRole(patients, 'gilles')
    const summary = computeDashboardSummary(scoped, 'gilles')

    expect(summary.mine).toBe(1)
    expect(getGillesDashboardLandingRedirect(summary, {}, 'gilles')).toBe(
      '/dashboard?all=1',
    )
    expect(getGillesDashboardLandingRedirect(summary, { all: '1' }, 'gilles')).toBeNull()
    expect(getGillesDashboardLandingRedirect(summary, { tab: 'revue' }, 'gilles')).toBeNull()
    expect(getGillesDashboardLandingRedirect(summary, { focus: 'mine' }, 'gilles')).toBeNull()
    expect(getGillesDashboardLandingRedirect(summary, {}, 'marcel')).toBeNull()

    const noMineSummary = computeDashboardSummary(
      filterPatientsForRole([patient('2', 'validated_medical')], 'gilles'),
      'gilles',
    )
    expect(getGillesDashboardLandingRedirect(noMineSummary, {}, 'gilles')).toBe('/dashboard?all=1')
  })
})
