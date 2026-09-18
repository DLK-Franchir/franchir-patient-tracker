import { isGillesErikVisibilityScope } from '@/lib/access-control'
import type { UserRole } from '@/lib/workflow-v2'

export type PatientDetailViewConfig = {
  showSharePoint: boolean
  /** Résumé clinique saisi à la création (lecture pour Gilles, édition limitée pour Marcel). */
  showClinicalSummary: boolean
  canManageDocuments: boolean
  showCommercialTab: boolean
  canManageQuestionnaire: boolean
  /** Synthèse PDF questionnaire (validation médicale Gilles, lecture Marcel/admin). */
  showQuestionnairePdf: boolean
  /** Dashboard cartes Anamneze (synthese JSON) sur fiche patient. */
  showAnamnezeDashboard: boolean
  showWorkflowActions: boolean
}

const DEFAULT_VIEW: PatientDetailViewConfig = {
  showSharePoint: true,
  showClinicalSummary: true,
  canManageDocuments: true,
  showCommercialTab: true,
  canManageQuestionnaire: true,
  showQuestionnairePdf: false,
  showAnamnezeDashboard: false,
  showWorkflowActions: true,
}

const GILLES_VIEW: PatientDetailViewConfig = {
  showSharePoint: false,
  showClinicalSummary: true,
  canManageDocuments: false,
  showCommercialTab: false,
  canManageQuestionnaire: false,
  showQuestionnairePdf: true,
  showAnamnezeDashboard: true,
  showWorkflowActions: true,
}

const IMAGING_SANDBOX_VIEW: PatientDetailViewConfig = {
  showSharePoint: false,
  showClinicalSummary: true,
  canManageDocuments: true,
  showCommercialTab: false,
  canManageQuestionnaire: false,
  showQuestionnairePdf: false,
  showAnamnezeDashboard: false,
  showWorkflowActions: false,
}

/** Marcel et admin peuvent consulter la synthèse PDF et le dashboard Anamneze en lecture seule. */
const READ_ONLY_MEDICAL_VIEW: Pick<
  PatientDetailViewConfig,
  'showQuestionnairePdf' | 'showAnamnezeDashboard'
> = {
  showQuestionnairePdf: true,
  showAnamnezeDashboard: true,
}

export function getPatientDetailViewConfig(
  role: UserRole,
  options?: { visibilityScope?: string | null },
): PatientDetailViewConfig {
  if (isGillesErikVisibilityScope(options?.visibilityScope)) {
    return IMAGING_SANDBOX_VIEW
  }

  if (role === 'gilles') {
    return GILLES_VIEW
  }

  if (role === 'marcel' || role === 'admin') {
    return { ...DEFAULT_VIEW, ...READ_ONLY_MEDICAL_VIEW }
  }

  return DEFAULT_VIEW
}
