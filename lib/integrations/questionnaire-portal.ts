/**
 * Accès au suivi questionnaire (app questionnaires) depuis le cockpit tracker.
 * Lecture du statut détaillé (lien actif + sessions longitudinales) et
 * révocation de lien, via les endpoints service-token. Fail-closed : si le
 * pont n'est pas configuré (`TRACKER_SYNC_SERVICE_TOKEN`), renvoie null/false
 * sans casser le rendu de la fiche.
 */

import { parseQuestionnaireLanguage } from '@/lib/integrations/questionnaire-language'

const BASE =
  process.env.QUESTIONNAIRES_API_BASE ||
  'https://questionnaire.franchir.eu/api/integrations/tracker'

function getBridgeToken(): string | undefined {
  return process.env.TRACKER_SYNC_SERVICE_TOKEN
}

/** Rattrapage si le webhook `sync-patient-to-questionnaires` a échoué (pont non provisionné, etc.). */
export async function syncPatientToQuestionnaires(patientId: string): Promise<boolean> {
  const token = getBridgeToken()
  if (!token) return false

  const { createServiceRoleClient } = await import('@/lib/supabase/service-role')
  const supabase = createServiceRoleClient()

  const { data: patient, error } = await supabase
    .from('patients')
    .select(
      'id, patient_name, patient_email, patient_phone, questionnaire_language, clinical_summary, sharepoint_link, form_types, current_status_id, assigned_surgeon_id',
    )
    .eq('id', patientId)
    .maybeSingle()

  if (error || !patient) return false

  let surgeonEmail: string | null = null
  let surgeonName: string | null = null
  let workflowStatus: string | null = null

  const [surgeonResult, statusResult] = await Promise.all([
    patient.assigned_surgeon_id
      ? supabase
          .from('surgeons')
          .select('full_name, email')
          .eq('id', patient.assigned_surgeon_id)
          .single()
      : Promise.resolve({ data: null }),
    patient.current_status_id
      ? supabase
          .from('workflow_statuses')
          .select('code')
          .eq('id', patient.current_status_id)
          .single()
      : Promise.resolve({ data: null }),
  ])

  const surgeon = surgeonResult.data as { full_name: string | null; email: string | null } | null
  const status = statusResult.data as { code: string } | null

  if (surgeon?.email) {
    surgeonEmail = surgeon.email
    surgeonName = surgeon.full_name ?? null
  }
  workflowStatus = status?.code ?? null

  try {
    const res = await fetch(`${BASE}/patient-upsert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        trackerPatientId: patient.id,
        patientName: patient.patient_name,
        patientEmail: patient.patient_email ?? null,
        patientPhone: patient.patient_phone ?? null,
        assignedSurgeonEmail: surgeonEmail,
        assignedSurgeonName: surgeonName,
        clinicalSummary: patient.clinical_summary ?? null,
        sharepointLink: patient.sharepoint_link ?? null,
        formTypes: Array.isArray(patient.form_types) ? patient.form_types : undefined,
        workflowStatus,
        language: parseQuestionnaireLanguage(patient.questionnaire_language),
      }),
    })
    return res.ok || res.status === 409
  } catch {
    return false
  }
}

export type QuestionnaireSessionSummary = {
  id: string
  label: string
  status: 'draft' | 'in_progress' | 'completed'
  createdAt: string
  completedAt: string | null
  isActive: boolean
}

export type QuestionnaireStatus = {
  activeLink: {
    status: string
    expiresAt: string
    sentAt: string | null
    openedAt: string | null
    completedAt: string | null
  } | null
  sessions: QuestionnaireSessionSummary[]
}

export async function fetchQuestionnaireStatus(
  trackerPatientId: string,
): Promise<QuestionnaireStatus | null> {
  const token = getBridgeToken()
  if (!token) return null
  try {
    const res = await fetch(
      `${BASE}/questionnaire-status?trackerPatientId=${encodeURIComponent(trackerPatientId)}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
    )
    if (!res.ok) return null
    return (await res.json()) as QuestionnaireStatus
  } catch {
    return null
  }
}

export async function revokeQuestionnaireLink(trackerPatientId: string): Promise<boolean> {
  const token = getBridgeToken()
  if (!token) return false
  try {
    const res = await fetch(`${BASE}/questionnaire-revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ trackerPatientId }),
    })
    return res.ok
  } catch {
    return false
  }
}

function isQuestionnaireCompletedOnPortal(status: QuestionnaireStatus): boolean {
  if (status.activeLink?.completedAt) return true
  return status.sessions.some((s) => s.status === 'completed')
}

/**
 * Rattrapage best-effort : si le portail questionnaires indique une complétion
 * mais que le tracker est encore en `sent`/NULL (callback retour manqué en prod),
 * on aligne le sous-état local. Idempotent ; ne rétrograde jamais un `completed`.
 */
export async function reconcileQuestionnaireCompletion(
  trackerPatientId: string,
  portalStatus: QuestionnaireStatus | null,
  currentTrackerStatus: string | null | undefined,
): Promise<boolean> {
  if (currentTrackerStatus === 'completed' || !portalStatus) return false
  if (!isQuestionnaireCompletedOnPortal(portalStatus)) return false

  const completedSession = portalStatus.sessions.find((s) => s.status === 'completed')
  const completedAt =
    portalStatus.activeLink?.completedAt ?? completedSession?.completedAt ?? new Date().toISOString()

  const { createServiceRoleClient } = await import('@/lib/supabase/service-role')
  const supabase = createServiceRoleClient()
  const { error } = await supabase
    .from('patients')
    .update({
      questionnaire_status: 'completed',
      questionnaire_completed_at: completedAt,
      questionnaire_summary:
        'Questionnaire complété par le patient (rattrapage automatique depuis le portail).',
    })
    .eq('id', trackerPatientId)
    .neq('questionnaire_status', 'completed')

  return !error
}
