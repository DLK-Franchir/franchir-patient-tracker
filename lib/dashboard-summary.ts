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
  /** Dossiers « mine » regroupés par GlobalStatus (tri décroissant). */
  mineBreakdown: MineBreakdownEntry[]
}

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

  return {
    mine,
    waiting,
    byGlobalStatus,
    totalActive: patients.length - closed,
    closed,
    mineBreakdown,
  }
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
