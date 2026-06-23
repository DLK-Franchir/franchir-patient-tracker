import type { UserRole } from '@/lib/workflow-v2'

export type PatientDetailViewConfig = {
  showSharePoint: boolean
  canManageDocuments: boolean
  showCommercialTab: boolean
  canManageQuestionnaire: boolean
  /** Synthèse PDF questionnaire (validation médicale Gilles, lecture Marcel/admin). */
  showQuestionnairePdf: boolean
  /** Dashboard cartes Anamneze (synthese JSON) sur fiche patient. */
  showAnamnezeDashboard: boolean
}

const DEFAULT_VIEW: PatientDetailViewConfig = {
  showSharePoint: true,
  canManageDocuments: true,
  showCommercialTab: true,
  canManageQuestionnaire: true,
  showQuestionnairePdf: false,
  showAnamnezeDashboard: false,
}

const GILLES_VIEW: PatientDetailViewConfig = {
  showSharePoint: false,
  canManageDocuments: false,
  showCommercialTab: false,
  canManageQuestionnaire: false,
  showQuestionnairePdf: true,
  showAnamnezeDashboard: true,
}

/** Marcel et admin peuvent consulter la synthèse PDF et le dashboard Anamneze en lecture seule. */
const READ_ONLY_MEDICAL_VIEW: Pick<
  PatientDetailViewConfig,
  'showQuestionnairePdf' | 'showAnamnezeDashboard'
> = {
  showQuestionnairePdf: true,
  showAnamnezeDashboard: true,
}

export function getPatientDetailViewConfig(role: UserRole): PatientDetailViewConfig {
  if (role === 'gilles') {
    return GILLES_VIEW
  }

  if (role === 'marcel' || role === 'admin') {
    return { ...DEFAULT_VIEW, ...READ_ONLY_MEDICAL_VIEW }
  }

  return DEFAULT_VIEW
}
