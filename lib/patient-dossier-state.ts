/** Code stable en base (`workflow_statuses.code`) pour un dossier archivé. */
export const CASE_CLOSED_STATUS_CODE = 'case_closed'

/** Couleur unifiée des badges liste dashboard quand le dossier est fermé. */
export const CLOSED_DOSSIER_GREY = '#9CA3AF'

export function isCaseClosedStatusCode(code?: string | null): boolean {
  return code?.toLowerCase() === CASE_CLOSED_STATUS_CODE
}

export function isCaseClosedPatient(patient: {
  workflow_statuses?: { code?: string | null } | null
}): boolean {
  return isCaseClosedStatusCode(patient.workflow_statuses?.code)
}
