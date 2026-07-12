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

export type DashboardSummary = {
  mine: number
  waiting: number
  byGlobalStatus: Record<GlobalStatus, number>
  totalActive: number
  closed: number
}

/** Codes DB (`workflow_statuses.code`) par GlobalStatus — aligné sur globalStatusFromWorkflowStatus. */
export const GLOBAL_STATUS_DB_CODES: Record<GlobalStatus, string[]> = {
  draft: ['draft', 'prospect', 'created'],
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

export function computeDashboardSummary(
  patients: SummaryPatient[],
  role: UserRole,
): DashboardSummary {
  const byGlobalStatus = EMPTY_BY_STATUS()
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
    } else if (isWaitingPatient(patient, role)) {
      waiting += 1
    }
  }

  return {
    mine,
    waiting,
    byGlobalStatus,
    totalActive: patients.length - closed,
    closed,
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

export type DashboardPriorityBanner = {
  globalStatus: GlobalStatus
  guidance: string
  waitingOnOther: boolean
  pendingActorLabel?: string
  waitingDetail?: string
}

export function getDashboardPriorityBanner(
  patients: SummaryPatient[],
  role: UserRole,
  summary: DashboardSummary,
): DashboardPriorityBanner | null {
  if (summary.mine > 0) {
    const minePatient = patients.find((patient) => isMinePatient(patient, role))
    if (!minePatient) return null
    const globalStatus = globalStatusFromWorkflowStatus(minePatient.workflow_statuses)
    const handoff = getWorkflowHandoff(globalStatus, role)
    const countLabel =
      summary.mine === 1 ? '1 dossier nécessite' : `${summary.mine} dossiers nécessitent`
    return {
      globalStatus,
      guidance: `${countLabel} votre action — ${handoff.guidance}`,
      waitingOnOther: false,
    }
  }

  if (summary.waiting > 0) {
    const waitingPatient = patients.find((patient) => isWaitingPatient(patient, role))
    if (!waitingPatient) return null
    const globalStatus = globalStatusFromWorkflowStatus(waitingPatient.workflow_statuses)
    const handoff = getWorkflowHandoff(globalStatus, role)
    const countLabel =
      summary.waiting === 1 ? '1 dossier est' : `${summary.waiting} dossiers sont`
    return {
      globalStatus,
      guidance: `${countLabel} en attente d'un autre intervenant.`,
      waitingOnOther: true,
      pendingActorLabel: handoff.pendingActorLabel,
      waitingDetail: handoff.waitingDetail,
    }
  }

  if (summary.totalActive > 0) {
    return {
      globalStatus: 'scheduled',
      guidance: 'Aucune action urgente — suivez l\'évolution des dossiers actifs.',
      waitingOnOther: false,
    }
  }

  return null
}

export function normalizeDashboardFocus(value: string | undefined): DashboardFocus {
  if (value === 'mine' || value === 'waiting') return value
  return 'all'
}

export function focusFilterLabel(focus: DashboardFocus): string | null {
  if (focus === 'mine') return 'Mes actions'
  if (focus === 'waiting') return 'En attente'
  return null
}
