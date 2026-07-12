import { createServerClient } from '@/lib/supabase/server'
import { isStaffProfile, requireStaffProfile } from '@/lib/access-control'
import { redirect } from 'next/navigation'
import PatientDetailClient from './client-page'
import AppHeader from '@/components/app-header'
import { type UserRole } from '@/lib/workflow-v2'
import { isRoleScopedPatient } from '@/lib/dashboard-summary'
import {
  fetchQuestionnaireStatus,
  reconcileQuestionnaireCompletion,
} from '@/lib/integrations/questionnaire-portal'
import { reconcileQuestionnaireSentStatus } from '@/lib/integrations/issue-questionnaire-link'
import { fetchQuestionnaireSynthesisPreview } from '@/lib/integrations/fetch-questionnaire-synthesis-preview'
import { getPatientDetailViewConfig } from '@/lib/patient-detail-view-config'
import type { QuestionnaireSynthesisPreview } from '@/lib/integrations/questionnaire-synthesis-preview.types'

export default async function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  if (!isStaffProfile(profile)) {
    redirect('/login?error=unauthorized')
  }

  const staffProfile = requireStaffProfile(profile)
  const userRole = staffProfile.role as UserRole

  const { data: patient } = await supabase
    .from('patients')
    .select(`
      *,
      current_status:workflow_statuses!current_status_id (
        id,
        code,
        label,
        color
      ),
      assigned_surgeon:surgeons!assigned_surgeon_id (
        id,
        full_name,
        email
      ),
      creator:profiles!created_by (
        full_name,
        role
      )
    `)
    .eq('id', id)
    .single()

  if (!patient) {
    redirect('/dashboard')
  }

  if (
    !isRoleScopedPatient(
      { id: patient.id, workflow_statuses: patient.current_status },
      userRole,
    )
  ) {
    redirect('/dashboard')
  }

  const { data: allMessages } = await supabase
    .from('patient_messages')
    .select('*')
    .eq('patient_id', id)
    .order('created_at', { ascending: true })

  // Annuaire chirurgiens actifs (id annuaire) pour l'assignation réelle — D6.
  const { data: surgeons } = await supabase
    .from('surgeons')
    .select('id, full_name')
    .eq('is_active', true)
    .order('full_name', { ascending: true })

  // Suivi questionnaire détaillé (lien actif + sessions longitudinales) depuis
  // l'app questionnaires. Best-effort : null si le pont n'est pas configuré.
  const questionnaireStatus = await fetchQuestionnaireStatus(id)

  // Rattrapage si le callback retour questionnaires → tracker a été manqué.
  const reconciled = await reconcileQuestionnaireCompletion(
    id,
    questionnaireStatus,
    patient.questionnaire_status,
  )
  if (reconciled) {
    patient.questionnaire_status = 'completed'
  }

  const sentReconciled = await reconcileQuestionnaireSentStatus(
    id,
    questionnaireStatus?.activeLink?.sentAt,
    patient.questionnaire_status,
  )
  if (sentReconciled) {
    patient.questionnaire_status = null
  }

  const viewConfig = getPatientDetailViewConfig(userRole)
  let synthesisPreview: QuestionnaireSynthesisPreview | null = null
  let synthesisPreviewError: string | null = null

  if (viewConfig.showAnamnezeDashboard && patient.questionnaire_status === 'completed') {
    const latestCompletedSession = questionnaireStatus?.sessions?.find((s) => s.status === 'completed')
    const previewResult = await fetchQuestionnaireSynthesisPreview(
      id,
      latestCompletedSession?.id,
    )
    if (previewResult.ok) {
      synthesisPreview = previewResult.preview
    } else {
      synthesisPreviewError = previewResult.message
    }
  }

  return (
    <>
      <AppHeader
        userRole={userRole}
        userName={staffProfile.full_name ?? undefined}
        patientName={patient.patient_name}
        showActions={true}
      />
      <div className="min-h-screen bg-franchir-cream [&_.anamneze-dashboard]:bg-transparent">
        <PatientDetailClient
          initialPatient={patient}
          initialMessages={allMessages || []}
          userRole={userRole}
          surgeons={surgeons || []}
          questionnaireStatus={questionnaireStatus}
          synthesisPreview={synthesisPreview}
          synthesisPreviewError={synthesisPreviewError}
        />
      </div>
    </>
  )
}
