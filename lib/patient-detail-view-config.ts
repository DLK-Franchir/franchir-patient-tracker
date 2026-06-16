import type { UserRole } from '@/lib/workflow-v2'

export type PatientDetailViewConfig = {
  showSharePoint: boolean
  showSurgeonAssignment: boolean
  canManageDocuments: boolean
  showCommercialTab: boolean
  canManageQuestionnaire: boolean
  /** Synthèse PDF questionnaire (validation médicale Gilles, lecture Marcel/admin). */
  showQuestionnairePdf: boolean
}

const DEFAULT_VIEW: PatientDetailViewConfig = {
  showSharePoint: true,
  showSurgeonAssignment: true,
  canManageDocuments: true,
  showCommercialTab: true,
  canManageQuestionnaire: true,
  showQuestionnairePdf: false,
}

const GILLES_VIEW: PatientDetailViewConfig = {
  showSharePoint: false,
  showSurgeonAssignment: false,
  canManageDocuments: false,
  showCommercialTab: false,
  canManageQuestionnaire: false,
  showQuestionnairePdf: true,
}

/** Marcel et admin peuvent consulter la synthèse PDF en lecture seule. */
const READ_ONLY_PDF_VIEW: Pick<PatientDetailViewConfig, 'showQuestionnairePdf'> = {
  showQuestionnairePdf: true,
}

export function getPatientDetailViewConfig(role: UserRole): PatientDetailViewConfig {
  if (role === 'gilles') {
    return GILLES_VIEW
  }

  if (role === 'marcel' || role === 'admin') {
    return { ...DEFAULT_VIEW, ...READ_ONLY_PDF_VIEW }
  }

  return DEFAULT_VIEW
}
