import { BRAND } from '@/lib/brand-tokens'
import {
  CASE_CLOSED_STATUS_CODE,
  getWorkflowHandoff,
  globalStatusFromWorkflowStatus,
  isClosedGlobalStatus,
  isWaitingOnOther,
  type GlobalStatus,
  type UserRole,
  type WorkflowStatus,
} from '@/lib/workflow-v2'

export type DashboardFocus = 'mine' | 'waiting' | 'all'

export type SummaryPatient = {
  id: string
  workflow_statuses: WorkflowStatus | null
}

export type SummaryPatientExtended = SummaryPatient & {
  quote_accepted?: boolean
  date_accepted?: boolean
}

export type MineBreakdownEntry = {
  globalStatus: GlobalStatus
  count: number
}

export type DashboardSummary = {
  mine: number
  waiting: number
  byGlobalStatus: Record<GlobalStatus, number>
  totalActive: number
  closed: number
  /** Commercial en attente de confirmation devis/date (rôles marcel/franchir/admin). */
  toConfirm: number
  /** Dossiers « mine » regroupés par GlobalStatus (tri décroissant). */
  mineBreakdown: MineBreakdownEntry[]
}

export type DashboardKpiId = 'actifs' | 'revue' | 'toConfirm' | 'scheduled' | 'completer' | 'suiviCommercial'

export type DashboardTabId =
  | 'actifs'
  | 'revue'
  | 'completer'
  | 'commercial'
  | 'scheduled'
  | 'rejected'
  | 'all'

export type DashboardKpi = {
  id: DashboardKpiId
  label: string
  sub: string
  count: number
  accentColor: string
  dotColor: string
  urgent?: boolean
  filter: {
    kpi?: DashboardKpiId | null
    tab?: DashboardTabId | null
    focus?: DashboardFocus | null
    status?: string[] | null
  }
}

export const DASHBOARD_TABS: Array<{
  id: DashboardTabId
  label: string
  globalStatuses: GlobalStatus[]
}> = [
  {
    id: 'actifs',
    label: 'Actifs',
    globalStatuses: [
      'draft',
      'medical_review',
      'medical_more_info',
      'commercial_in_progress',
      'scheduled',
    ],
  },
  { id: 'revue', label: 'Revue méd.', globalStatuses: ['medical_review'] },
  { id: 'completer', label: 'À compléter', globalStatuses: ['medical_more_info'] },
  { id: 'commercial', label: 'Commercial', globalStatuses: ['commercial_in_progress'] },
  { id: 'scheduled', label: 'Programmé', globalStatuses: ['scheduled'] },
  { id: 'rejected', label: 'Refusé', globalStatuses: ['rejected'] },
  {
    id: 'all',
    label: 'Tous',
    globalStatuses: [
      'draft',
      'medical_review',
      'medical_more_info',
      'commercial_in_progress',
      'scheduled',
      'rejected',
      'closed',
    ],
  },
]

/** Codes DB (`workflow_statuses.code`) par GlobalStatus — aligné sur globalStatusFromWorkflowStatus. */
export const GLOBAL_STATUS_DB_CODES: Record<GlobalStatus, string[]> = {
  draft: ['draft', 'prospect', 'created', 'prospect_created'],
  medical_review: ['medical_review', 'pending_medical', 'awaiting_medical'],
  medical_more_info: ['need_info', 'medical_more_info', 'incomplete'],
  rejected: ['rejected_medical', 'rejected', 'refused'],
  commercial_in_progress: [
    'validated_medical',
    'approved_medical',
    'commercial',
    'quote_pending',
    'awaiting_quote',
  ],
  scheduled: ['surgery_scheduled', 'scheduled', 'confirmed'],
  closed: [CASE_CLOSED_STATUS_CODE, 'closed', 'archived'],
}

export const GLOBAL_STATUS_LABELS: Record<GlobalStatus, string> = {
  draft: 'Brouillon',
  medical_review: 'Revue médicale',
  medical_more_info: 'À compléter',
  rejected: 'Refusé',
  commercial_in_progress: 'Commercial',
  scheduled: 'Programmé',
  closed: 'Fermé',
}

/** Pipeline actif affiché dans les chips (hors fermé). */
export const PIPELINE_GLOBAL_STATUSES: GlobalStatus[] = [
  'draft',
  'medical_review',
  'medical_more_info',
  'commercial_in_progress',
  'scheduled',
  'rejected',
]

const EMPTY_BY_STATUS = (): Record<GlobalStatus, number> => ({
  draft: 0,
  medical_review: 0,
  medical_more_info: 0,
  rejected: 0,
  commercial_in_progress: 0,
  scheduled: 0,
  closed: 0,
})

export function pendingActionLabel(globalStatus: GlobalStatus, role: UserRole): string | null {
  const handoff = getWorkflowHandoff(globalStatus, role)
  if (isWaitingOnOther(handoff, role)) return null
  if (handoff.pendingActor === role) return handoff.guidance
  return null
}

/** Libellé court pour la colonne « Action en attente » (tableau dashboard). */
export function getShortPendingActionLabel(globalStatus: GlobalStatus, role: UserRole): string | null {
  if (pendingActionLabel(globalStatus, role) === null) return null

  switch (globalStatus) {
    case 'draft':
      return 'Soumettre au médical'
    case 'medical_review':
      return 'Revue médicale'
    case 'medical_more_info':
      return 'Compléter dossier'
    case 'commercial_in_progress':
      return role === 'franchir' ? 'Gérer devis/dates' : 'Confirmer devis/date'
    case 'rejected':
      return role === 'admin' ? 'Réouvrir dossier' : null
    default:
      return null
  }
}

export function isMinePatient(patient: SummaryPatient, role: UserRole): boolean {
  const globalStatus = globalStatusFromWorkflowStatus(patient.workflow_statuses)
  if (isClosedGlobalStatus(globalStatus)) return false
  return pendingActionLabel(globalStatus, role) !== null
}

export function isWaitingPatient(patient: SummaryPatient, role: UserRole): boolean {
  const globalStatus = globalStatusFromWorkflowStatus(patient.workflow_statuses)
  if (isClosedGlobalStatus(globalStatus)) return false
  const handoff = getWorkflowHandoff(globalStatus, role)
  return isWaitingOnOther(handoff, role)
}

/** Dossiers visibles pour Gilles : revue, complément demandé, suivi post-validation ou refusé. */
const GILLES_VISIBLE_STATUSES = new Set<GlobalStatus>([
  'medical_review',
  'medical_more_info',
  'commercial_in_progress',
  'scheduled',
  'rejected',
])

export function isRoleScopedPatient(patient: SummaryPatient, role: UserRole): boolean {
  if (role !== 'gilles') return true
  const globalStatus = globalStatusFromWorkflowStatus(patient.workflow_statuses)
  if (isClosedGlobalStatus(globalStatus)) return false
  return GILLES_VISIBLE_STATUSES.has(globalStatus)
}

export function filterPatientsForRole<T extends SummaryPatient>(
  patients: T[],
  role: UserRole,
): T[] {
  if (role !== 'gilles') return patients
  return patients.filter((patient) => isRoleScopedPatient(patient, role))
}

/** Restriction de liste par rôle (`null` = pas de filtre de base). */
export function getRoleScopedPatientIds(
  patients: SummaryPatient[],
  role: UserRole,
): string[] | null {
  if (role !== 'gilles') return null
  return filterPatientsForRole(patients, role).map((patient) => patient.id)
}

export function intersectPatientIds(
  ...lists: Array<string[] | null | undefined>
): string[] | null {
  const defined = lists.filter((list): list is string[] => Array.isArray(list))
  if (defined.length === 0) return null
  return defined.reduce((acc, list) => acc.filter((id) => list.includes(id)))
}

export function getDashboardTabsForRole(role: UserRole): typeof DASHBOARD_TABS {
  if (role === 'gilles') {
    return DASHBOARD_TABS.filter((tab) =>
      ['revue', 'completer', 'commercial', 'scheduled', 'rejected'].includes(tab.id),
    )
  }
  return DASHBOARD_TABS
}

export function getDefaultDashboardTab(
  role: UserRole,
  summary: DashboardSummary,
): DashboardTabId | null {
  if (role !== 'gilles') return null
  if (summary.byGlobalStatus.medical_review > 0) return 'revue'
  if (summary.byGlobalStatus.medical_more_info > 0) return 'completer'
  if (summary.byGlobalStatus.commercial_in_progress > 0) return 'commercial'
  if (summary.byGlobalStatus.scheduled > 0) return 'scheduled'
  if (summary.byGlobalStatus.rejected > 0) return 'rejected'
  return 'revue'
}

export function globalStatusToDbCodes(globalStatus: GlobalStatus): string[] {
  return GLOBAL_STATUS_DB_CODES[globalStatus]
}

export function selectedGlobalStatusFromCodes(codes: string[]): GlobalStatus | null {
  for (const status of PIPELINE_GLOBAL_STATUSES) {
    const dbCodes = GLOBAL_STATUS_DB_CODES[status]
    if (dbCodes.some((code) => codes.includes(code))) {
      return status
    }
  }
  if (GLOBAL_STATUS_DB_CODES.closed.some((code) => codes.includes(code))) {
    return 'closed'
  }
  return null
}

const MINE_BREAKDOWN_ORDER: GlobalStatus[] = [
  'draft',
  'medical_review',
  'medical_more_info',
  'commercial_in_progress',
  'rejected',
]

/** Libellé court pour la ventilation « mine » dans le bandeau priorité. */
export function mineActionShortLabel(globalStatus: GlobalStatus, role: UserRole): string {
  switch (globalStatus) {
    case 'draft':
      return 'à soumettre'
    case 'medical_review':
      return 'en revue médicale'
    case 'medical_more_info':
      return 'complément'
    case 'commercial_in_progress':
      return role === 'franchir' ? 'devis à gérer' : 'devis à confirmer'
    case 'rejected':
      return 'refusé à traiter'
    default:
      return GLOBAL_STATUS_LABELS[globalStatus].toLowerCase()
  }
}

export function formatMineBreakdown(
  breakdown: MineBreakdownEntry[],
  role: UserRole,
): string {
  return breakdown
    .map(({ globalStatus, count }) => `${count} ${mineActionShortLabel(globalStatus, role)}`)
    .join(' · ')
}

export function computeDashboardSummary(
  patients: SummaryPatient[],
  role: UserRole,
  patientsExtended?: SummaryPatientExtended[],
): DashboardSummary {
  const byGlobalStatus = EMPTY_BY_STATUS()
  const mineByStatus = EMPTY_BY_STATUS()
  let mine = 0
  let waiting = 0
  let closed = 0

  for (const patient of patients) {
    const globalStatus = globalStatusFromWorkflowStatus(patient.workflow_statuses)
    byGlobalStatus[globalStatus] += 1

    if (isClosedGlobalStatus(globalStatus)) {
      closed += 1
      continue
    }

    if (isMinePatient(patient, role)) {
      mine += 1
      mineByStatus[globalStatus] += 1
    } else if (isWaitingPatient(patient, role)) {
      waiting += 1
    }
  }

  const mineBreakdown = MINE_BREAKDOWN_ORDER
    .map((globalStatus) => ({ globalStatus, count: mineByStatus[globalStatus] }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count)

  const extended = patientsExtended ?? (patients as SummaryPatientExtended[])

  return {
    mine,
    waiting,
    byGlobalStatus,
    totalActive: patients.length - closed,
    closed,
    toConfirm: countToConfirm(extended, role),
    mineBreakdown,
  }
}

const TO_CONFIRM_ROLES: UserRole[] = ['marcel', 'franchir', 'admin']

export function isToConfirmPatient(patient: SummaryPatientExtended): boolean {
  const globalStatus = globalStatusFromWorkflowStatus(patient.workflow_statuses)
  if (globalStatus !== 'commercial_in_progress') return false
  return !patient.quote_accepted || !patient.date_accepted
}

export function countToConfirm(patients: SummaryPatientExtended[], role: UserRole): number {
  if (!TO_CONFIRM_ROLES.includes(role)) return 0
  return patients.filter(isToConfirmPatient).length
}

export function getActifsPatientIds(patients: SummaryPatient[]): string[] {
  return patients
    .filter((patient) => {
      const globalStatus = globalStatusFromWorkflowStatus(patient.workflow_statuses)
      return !isClosedGlobalStatus(globalStatus) && globalStatus !== 'rejected'
    })
    .map((patient) => patient.id)
}

export function getToConfirmPatientIds(patients: SummaryPatientExtended[]): string[] {
  return patients.filter(isToConfirmPatient).map((patient) => patient.id)
}

export function getTabPatientIds(
  patients: SummaryPatient[],
  tab: DashboardTabId,
): string[] {
  if (tab === 'actifs') {
    return getActifsPatientIds(patients)
  }

  const tabDef = DASHBOARD_TABS.find((entry) => entry.id === tab)
  if (!tabDef) return patients.map((patient) => patient.id)

  const allowed = new Set(tabDef.globalStatuses)
  return patients
    .filter((patient) => allowed.has(globalStatusFromWorkflowStatus(patient.workflow_statuses)))
    .map((patient) => patient.id)
}

export function getTabCount(summary: DashboardSummary, tab: DashboardTabId): number {
  if (tab === 'actifs') {
    return summary.totalActive - summary.byGlobalStatus.rejected
  }
  if (tab === 'all') {
    return summary.totalActive + summary.closed
  }
  const tabDef = DASHBOARD_TABS.find((entry) => entry.id === tab)
  if (!tabDef) return 0
  return tabDef.globalStatuses.reduce((sum, status) => sum + summary.byGlobalStatus[status], 0)
}

export function getDashboardKpis(
  summary: DashboardSummary,
  role: UserRole,
  patientsExtended?: SummaryPatientExtended[],
): DashboardKpi[] {
  const toConfirm =
    patientsExtended !== undefined
      ? countToConfirm(patientsExtended, role)
      : summary.toConfirm

  const actifsCount = summary.totalActive - summary.byGlobalStatus.rejected

  const kpis: DashboardKpi[] = [
    {
      id: 'actifs',
      label: 'Dossiers actifs',
      sub: 'Total en cours',
      count: actifsCount,
      accentColor: BRAND.navy,
      dotColor: BRAND.navyLight,
      filter: { kpi: 'actifs', tab: 'actifs', focus: null, status: null },
    },
    {
      id: 'revue',
      label: 'Revue médicale',
      sub: 'Att. Dr. Gilles',
      count: summary.byGlobalStatus.medical_review,
      accentColor: BRAND.revue,
      dotColor: BRAND.revue,
      urgent: summary.byGlobalStatus.medical_review > 0,
      filter: {
        kpi: 'revue',
        tab: 'revue',
        focus: null,
        status: GLOBAL_STATUS_DB_CODES.medical_review,
      },
    },
    {
      id: 'toConfirm',
      label: 'À confirmer',
      sub: 'Budget ou date en attente',
      count: toConfirm,
      accentColor: BRAND.commercial,
      dotColor: BRAND.commercial,
      urgent: toConfirm > 0 && TO_CONFIRM_ROLES.includes(role),
      filter: {
        kpi: 'toConfirm',
        tab: 'commercial',
        focus: null,
        status: GLOBAL_STATUS_DB_CODES.commercial_in_progress,
      },
    },
    {
      id: 'scheduled',
      label: 'Programmés',
      sub: 'Intervention planifiée',
      count: summary.byGlobalStatus.scheduled,
      accentColor: BRAND.green,
      dotColor: BRAND.green,
      filter: {
        kpi: 'scheduled',
        tab: 'scheduled',
        focus: null,
        status: GLOBAL_STATUS_DB_CODES.scheduled,
      },
    },
    {
      id: 'completer',
      label: 'À compléter',
      sub: 'Pièces manquantes',
      count: summary.byGlobalStatus.medical_more_info,
      accentColor: BRAND.coral,
      dotColor: BRAND.coral,
      urgent: summary.byGlobalStatus.medical_more_info > 0,
      filter: {
        kpi: 'completer',
        tab: 'completer',
        focus: null,
        status: GLOBAL_STATUS_DB_CODES.medical_more_info,
      },
    },
  ]

  if (role === 'gilles') {
    const revue = kpis.find((kpi) => kpi.id === 'revue')
    const completer = kpis.find((kpi) => kpi.id === 'completer')
    const scheduled = kpis.find((kpi) => kpi.id === 'scheduled')
    const suiviCommercial: DashboardKpi = {
      id: 'suiviCommercial',
      label: 'Suivi commercial',
      sub: 'Chirurgien et date proposée',
      count: summary.byGlobalStatus.commercial_in_progress,
      accentColor: BRAND.navy,
      dotColor: BRAND.navyLight,
      filter: {
        kpi: 'suiviCommercial',
        tab: 'commercial',
        focus: null,
        status: GLOBAL_STATUS_DB_CODES.commercial_in_progress,
      },
    }
    const gillesKpis = [revue, suiviCommercial, scheduled, completer].filter(
      (kpi): kpi is DashboardKpi => kpi != null,
    )
    if (revue) {
      gillesKpis[0] = { ...revue, sub: 'Action requise de votre part' }
    }
    const completerIdx = gillesKpis.findIndex((kpi) => kpi.id === 'completer')
    if (completerIdx >= 0) {
      gillesKpis[completerIdx] = {
        ...gillesKpis[completerIdx],
        sub: 'Complément demandé — en attente de Marcel',
        urgent: false,
      }
    }
    return gillesKpis
  }

  return kpis
}

export function normalizeDashboardTab(value: string | undefined): DashboardTabId | null {
  const valid: DashboardTabId[] = [
    'actifs',
    'revue',
    'completer',
    'commercial',
    'scheduled',
    'rejected',
    'all',
  ]
  return valid.includes(value as DashboardTabId) ? (value as DashboardTabId) : null
}

export function normalizeDashboardKpi(value: string | undefined): DashboardKpiId | null {
  const valid: DashboardKpiId[] = ['actifs', 'revue', 'toConfirm', 'scheduled', 'completer', 'suiviCommercial']
  return valid.includes(value as DashboardKpiId) ? (value as DashboardKpiId) : null
}

const GILLES_TAB_IDS = new Set<DashboardTabId>([
  'revue',
  'completer',
  'commercial',
  'scheduled',
  'rejected',
])

const GILLES_KPI_IDS = new Set<DashboardKpiId>(['revue', 'completer', 'scheduled', 'suiviCommercial'])

export function normalizeDashboardTabForRole(
  tab: DashboardTabId | null,
  role: UserRole,
): DashboardTabId | null {
  if (!tab || role !== 'gilles') return tab
  return GILLES_TAB_IDS.has(tab) ? tab : null
}

export function normalizeDashboardKpiForRole(
  kpi: DashboardKpiId | null,
  role: UserRole,
): DashboardKpiId | null {
  if (!kpi || role !== 'gilles') return kpi
  return GILLES_KPI_IDS.has(kpi) ? kpi : null
}

export type DashboardListFilterParams = {
  focus?: string
  tab?: string
  kpi?: string
  status?: string | string[]
  q?: string
  all?: string
}

/** True si l'utilisateur a choisi un filtre liste explicite (hors pagination/tri). */
export function hasExplicitDashboardListFilter(params: DashboardListFilterParams): boolean {
  if (params.all === '1') return true
  if (params.focus?.trim()) return true
  if (params.tab?.trim()) return true
  if (params.kpi?.trim()) return true
  if ((params.q || '').trim()) return true
  const statuses = Array.isArray(params.status)
    ? params.status
    : params.status
      ? [params.status]
      : []
  return statuses.some((code) => code.trim().length > 0)
}

/** Vue « tous les dossiers » explicite (Gilles) — ignore tab/kpi/focus/status résiduels. */
export function isDashboardShowAllScope(params: DashboardListFilterParams): boolean {
  return params.all === '1'
}

const KPI_TO_TAB: Partial<Record<DashboardKpiId, DashboardTabId>> = {
  revue: 'revue',
  completer: 'completer',
  scheduled: 'scheduled',
  suiviCommercial: 'commercial',
  toConfirm: 'commercial',
}

/** Onglet effectif dérivé uniquement des paramètres URL tab/kpi (pas d'inférence visuelle). */
export function getEffectiveDashboardTab(
  activeTab: DashboardTabId | null,
  activeKpi: DashboardKpiId | null,
): DashboardTabId | null {
  if (activeTab) return activeTab
  if (activeKpi && KPI_TO_TAB[activeKpi]) return KPI_TO_TAB[activeKpi] ?? null
  return null
}

/** Résout les IDs liste dashboard à partir des paramètres cockpit (source unique serveur). */
export function resolveDashboardListFilterIds(
  patients: SummaryPatient[],
  role: UserRole,
  options: {
    focus: DashboardFocus
    activeTab: DashboardTabId | null
    activeKpi: DashboardKpiId | null
    pipelineGlobalStatus: GlobalStatus | null
    patientsExtended?: SummaryPatientExtended[]
  },
): string[] | null {
  const { focus, activeTab, activeKpi, pipelineGlobalStatus, patientsExtended } = options

  if (focus !== 'all') {
    return getFocusPatientIds(patients, role, focus)
  }

  if (activeKpi === 'toConfirm') {
    return getToConfirmPatientIds((patientsExtended ?? patients) as SummaryPatientExtended[])
  }
  if (activeKpi === 'actifs') {
    return getActifsPatientIds(patients)
  }

  const tabFromKpi = activeKpi ? KPI_TO_TAB[activeKpi] : null
  const effectiveTab = activeTab ?? tabFromKpi ?? null
  if (effectiveTab) {
    return getTabPatientIds(patients, effectiveTab)
  }

  if (pipelineGlobalStatus) {
    return getPipelinePatientIds(patients, pipelineGlobalStatus)
  }

  return null
}

/** Message prioritaire direct pour le Dr Dubois. */
export function getGillesPriorityMessage(summary: DashboardSummary): string | null {
  const count = summary.byGlobalStatus.medical_review
  if (count <= 0) return null
  if (count === 1) {
    return 'Vous avez 1 revue médicale à traiter.'
  }
  return `Vous avez ${count} revues médicales à traiter.`
}

/** Redirection d'atterrissage Gilles : vue « Tous les dossiers » par défaut. */
export function getGillesDashboardLandingRedirect(
  _summary: DashboardSummary,
  params: DashboardListFilterParams,
  role: UserRole,
): string | null {
  if (role !== 'gilles') return null
  if (hasExplicitDashboardListFilter(params)) return null
  return '/dashboard?all=1'
}

/** Filtre URL invalidé par le rôle (ex. bookmark Marcel `tab=actifs` pour Gilles). */
export function hadRoleInvalidatedListFilter(
  params: { tab?: string; kpi?: string },
  role: UserRole,
): boolean {
  if (role !== 'gilles') return false
  const rawTab = normalizeDashboardTab(params.tab)
  if (rawTab && normalizeDashboardTabForRole(rawTab, role) === null) return true
  const rawKpi = normalizeDashboardKpi(params.kpi)
  if (rawKpi && normalizeDashboardKpiForRole(rawKpi, role) === null) return true
  return false
}

/** Libellé court pour la colonne « Étape courante ». */
export function getCurrentStepLabel(globalStatus: GlobalStatus, role: UserRole): string {
  return getWorkflowHandoff(globalStatus, role).guidance
}

export function getFocusPatientIds(
  patients: SummaryPatient[],
  role: UserRole,
  focus: DashboardFocus,
): string[] | null {
  if (focus === 'all') return null

  const matcher = focus === 'mine' ? isMinePatient : isWaitingPatient
  return patients.filter((patient) => matcher(patient, role)).map((patient) => patient.id)
}

/** Filtre pipeline par GlobalStatus — même logique que computeDashboardSummary (compteur chips). */
export function getPipelinePatientIds(
  patients: SummaryPatient[],
  globalStatus: GlobalStatus,
): string[] {
  return patients
    .filter((patient) => globalStatusFromWorkflowStatus(patient.workflow_statuses) === globalStatus)
    .map((patient) => patient.id)
}

export type PriorityBannerVariant = 'action' | 'neutral'

export type PriorityBannerContent = {
  title: string
  subtitle: string
  variant: PriorityBannerVariant
  globalStatus: GlobalStatus
  waitingOnOther?: boolean
  pendingActorLabel?: string
  waitingDetail?: string
}

/** @deprecated Utiliser PriorityBannerContent + getPriorityBannerContent. */
export type DashboardPriorityBanner = PriorityBannerContent & {
  guidance: string
}

function formatActiveDossiersLabel(totalActive: number): string {
  return totalActive === 1 ? '1 dossier actif' : `${totalActive} dossiers actifs`
}

function formatMineAwaitLabel(mine: number): string {
  return mine === 1 ? '1 dossier vous attend' : `${mine} dossiers vous attendent`
}

function formatWaitingProgressLabel(waiting: number): string {
  return waiting === 1
    ? '1 dossier en cours chez un autre intervenant'
    : `${waiting} dossiers en cours chez d'autres intervenants`
}

/**
 * Bandeau cockpit : total actif + actions « mine » ventilées.
 * Ne mélange jamais totalActive / guidance pipeline quand mine === 0.
 */
export function getPriorityBannerContent(
  summary: DashboardSummary,
  role: UserRole,
): PriorityBannerContent | null {
  if (summary.totalActive === 0) {
    return null
  }

  const title = formatActiveDossiersLabel(summary.totalActive)

  if (summary.mine > 0) {
    const dominant = summary.mineBreakdown[0]
    if (!dominant) return null

    const handoff = getWorkflowHandoff(dominant.globalStatus, role)
    const mineLabel = formatMineAwaitLabel(summary.mine)
    const actionDetail =
      summary.mineBreakdown.length === 1
        ? handoff.guidance
        : formatMineBreakdown(summary.mineBreakdown, role)

    return {
      title,
      subtitle: `${mineLabel} — ${actionDetail}`,
      variant: 'action',
      globalStatus: dominant.globalStatus,
      waitingOnOther: false,
    }
  }

  let subtitle = 'Aucune action requise de votre part'
  if (summary.waiting > 0) {
    subtitle = `${subtitle} · ${formatWaitingProgressLabel(summary.waiting)}`
  }

  return {
    title,
    subtitle,
    variant: 'neutral',
    globalStatus: 'scheduled',
    waitingOnOther: false,
  }
}

/** @deprecated Préférer getPriorityBannerContent — conserve la forme legacy guidance. */
export function getDashboardPriorityBanner(
  _patients: SummaryPatient[],
  role: UserRole,
  summary: DashboardSummary,
): DashboardPriorityBanner | null {
  const content = getPriorityBannerContent(summary, role)
  if (!content) return null
  return { ...content, guidance: `${content.title} — ${content.subtitle}` }
}

export function normalizeDashboardFocus(value: string | undefined): DashboardFocus {
  if (value === 'mine') return 'mine'
  // focus=waiting déprécié — plus de chip « En attente »
  return 'all'
}

export function focusFilterLabel(focus: DashboardFocus): string | null {
  if (focus === 'mine') return 'Mes actions'
  return null
}
