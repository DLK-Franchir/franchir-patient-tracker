'use client'

import { useState, lazy, Suspense, useEffect } from 'react'
import { Mail, Phone } from 'lucide-react'
import { WorkflowActionHistory, usePatientActionLog } from '@/components/workflow-action-history'
import MessageThread, { type Message } from '@/components/patient/message-thread'
import PatientSummaryCard from '@/components/patient-summary-card'
import { PatientDossierIdentityCard } from '@/components/patient/patient-dossier-identity-card'
import { PatientPageHeader } from '@/components/patient/patient-page-header'
import { PatientWorkContextBanner } from '@/components/patient/patient-work-context-banner'
import { PatientActionPanel } from '@/components/patient/patient-action-panel'
import DocumentsSection from '@/components/patient/documents-section'
import QuestionnairePatientCard from '@/components/patient/questionnaire-patient-card'
import QuestionnaireDispatchModal, {
  type QuestionnaireDispatchPayload,
} from '@/components/patient/questionnaire-dispatch-modal'
import AnamnezeSection from '@/components/patient/synthesis/anamneze-section'
import { globalStatusFromWorkflowStatus, type GlobalStatus, type UserRole } from '@/lib/workflow-v2'
import { getWorkContext } from '@/lib/patient-work-context'
import { getPatientDetailViewConfig } from '@/lib/patient-detail-view-config'
import type { SurgeonOption } from '@/components/workflow-actions'
import type { QuestionnaireStatus } from '@/lib/integrations/questionnaire-portal'
import type { QuestionnaireSynthesisPreview } from '@/lib/integrations/questionnaire-synthesis-preview.types'
import {
  type QuestionnaireFormType,
  coercePatientFormTypes,
  normalizeFormTypes,
} from '@/lib/integrations/questionnaire-form-types'
import { buildQuestionnaireEmailDraft } from '@/lib/integrations/questionnaire-email-draft'
import { useRouter } from 'next/navigation'

const MessageComposer = lazy(() => import('@/components/patient/message-composer'))

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  )
}

interface PatientData {
  id: string
  patient_name: string
  patient_email?: string | null
  patient_phone?: string | null
  questionnaire_language: 'fr' | 'en'
  form_types?: QuestionnaireFormType[] | null
  clinical_summary: string | null
  sharepoint_link: string | null
  created_at: string
  questionnaire_status?: string | null
  questionnaire_completed_at?: string | null
  questionnaire_summary?: string | null
  quote_amount?: number | null
  proposed_date?: string | null
  quote_accepted?: boolean
  date_accepted?: boolean
  assigned_surgeon_id?: string | null
  assigned_surgeon?: {
    id: string
    full_name: string
    email?: string | null
  } | null
  current_status: {
    id: string
    code: string
    label: string
    color: string
  }
  creator: {
    full_name: string
    role: string
  }
}

export default function PatientDetailClient({
  initialPatient,
  initialMessages,
  userRole,
  surgeons = [],
  questionnaireStatus = null,
  synthesisPreview = null,
  synthesisPreviewError = null,
}: {
  initialPatient: PatientData
  initialMessages: Message[]
  userRole: UserRole
  surgeons?: SurgeonOption[]
  questionnaireStatus?: QuestionnaireStatus | null
  synthesisPreview?: QuestionnaireSynthesisPreview | null
  synthesisPreviewError?: string | null
}) {
  const router = useRouter()
  const [patient, setPatient] = useState(initialPatient)
  const [questionnaireLanguage, setQuestionnaireLanguage] = useState<'fr' | 'en'>(
    initialPatient.questionnaire_language === 'en' ? 'en' : 'fr',
  )
  const [createQuestionnaireWarning, setCreateQuestionnaireWarning] = useState<string | null>(null)
  const [questionnaireLinkNotice, setQuestionnaireLinkNotice] = useState<{
    tone: 'success' | 'warning' | 'error'
    message: string
  } | null>(null)
  const [dispatchPayload, setDispatchPayload] = useState<QuestionnaireDispatchPayload | null>(null)
  const [dispatchConfirming, setDispatchConfirming] = useState(false)

  useEffect(() => {
    setPatient(initialPatient)
    setQuestionnaireLanguage(initialPatient.questionnaire_language === 'en' ? 'en' : 'fr')
  }, [initialPatient])

  useEffect(() => {
    try {
      const warning = sessionStorage.getItem('franchir-questionnaire-create-warning')
      if (warning) {
        sessionStorage.removeItem('franchir-questionnaire-create-warning')
        setCreateQuestionnaireWarning(warning)
      }
    } catch {
      // sessionStorage indisponible
    }
  }, [])

  const viewConfig = getPatientDetailViewConfig(userRole)
  const canManageQuestionnaire = viewConfig.canManageQuestionnaire

  const prepareQuestionnaireLink = async (
    formTypes: QuestionnaireFormType[],
    language: 'fr' | 'en',
  ) => {
    try {
      const response = await fetch(`/api/patients/${patient.id}/questionnaire-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, formTypes, sendEmail: false }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Échec de la préparation du lien")
      }
      setQuestionnaireLanguage(language)
      setPatient((p) => ({
        ...p,
        questionnaire_language: language,
        form_types: normalizeFormTypes(formTypes),
        questionnaire_status:
          p.questionnaire_status === 'completed'
            ? 'completed'
            : data.emailSent
              ? 'sent'
              : p.questionnaire_status,
      }))

      if (data.dispatchMode === 'staff' && typeof data.url === 'string' && data.url) {
        const draft =
          data.emailDraft &&
          typeof data.emailDraft.subject === 'string' &&
          typeof data.emailDraft.textBody === 'string'
            ? {
                subject: data.emailDraft.subject as string,
                textBody: data.emailDraft.textBody as string,
              }
            : buildQuestionnaireEmailDraft({
                language,
                formTypes: normalizeFormTypes(formTypes),
                patientName: patient.patient_name,
                questionnaireUrl: data.url,
              })
        setDispatchPayload({
          to: patient.patient_email ?? '',
          questionnaireUrl: data.url,
          draft,
          expiresAt: data.expiresAt ?? null,
        })
        setQuestionnaireLinkNotice({
          tone: 'success',
          message: 'Lien prêt — copiez le message dans votre boîte mail ou WhatsApp.',
        })
      } else if (data.emailSent) {
        setDispatchPayload(null)
        setQuestionnaireLinkNotice({
          tone: 'warning',
          message:
            'Mode legacy : le portail a encore envoyé le mail via Resend (sans URL pour copie). Déployez la PR questionnaires pour le dispatch staff.',
        })
      } else {
        setDispatchPayload(null)
        setQuestionnaireLinkNotice({
          tone: 'error',
          message:
            "Lien préparé mais URL indisponible. Vérifiez le contrat pont (sendEmail=false) côté questionnaires.",
        })
      }
      router.refresh()
    } catch (error) {
      setQuestionnaireLinkNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Une erreur est survenue',
      })
      throw error
    }
  }

  const confirmQuestionnaireDispatch = async () => {
    setDispatchConfirming(true)
    try {
      const response = await fetch(
        `/api/patients/${patient.id}/questionnaire-dispatch-confirm`,
        { method: 'POST' },
      )
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || "Échec de la confirmation d'envoi")
      }
      setPatient((p) => ({
        ...p,
        questionnaire_status:
          p.questionnaire_status === 'completed' ? 'completed' : 'sent',
      }))
      setDispatchPayload(null)
      setQuestionnaireLinkNotice({
        tone: 'success',
        message: 'Envoi confirmé — le dossier est marqué « lien envoyé ».',
      })
      router.refresh()
    } catch (error) {
      setQuestionnaireLinkNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Une erreur est survenue',
      })
    } finally {
      setDispatchConfirming(false)
    }
  }

  const revokeQuestionnaireLink = async () => {
    if (!confirm('Révoquer le lien actif de ce patient ? Il ne pourra plus accéder au questionnaire avec ce lien.')) {
      return
    }
    try {
      const response = await fetch(`/api/patients/${patient.id}/questionnaire-revoke`, { method: 'POST' })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Échec de la révocation')
      }
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Une erreur est survenue')
      throw error
    }
  }

  const globalStatus: GlobalStatus = globalStatusFromWorkflowStatus(patient.current_status)
  const questionnaireFormTypes = coercePatientFormTypes(patient.form_types)

  const medicalMessages = initialMessages.filter(
    (m) => m.topic === 'medical' || m.topic === 'system' || !m.topic,
  )

  const commercialMessages = initialMessages.filter((m) => m.topic === 'commercial')

  const showCommercialData =
    viewConfig.showCommercialTab &&
    (globalStatus === 'commercial_in_progress' ||
      globalStatus === 'scheduled' ||
      patient.quote_amount != null ||
      patient.proposed_date != null ||
      patient.assigned_surgeon != null)

  const isClosedDossier = globalStatus === 'closed'

  const isReadOnly =
    (globalStatus === 'rejected' || isClosedDossier) && userRole !== 'admin'
  const canMutateDossierContent = !isReadOnly
  const canManageQuestionnaireEffective = canManageQuestionnaire && canMutateDossierContent
  const canManageDocumentsEffective = viewConfig.canManageDocuments && canMutateDossierContent
  const latestCompletedSession = questionnaireStatus?.sessions?.find((s) => s.status === 'completed')
  const actionLogMessages = usePatientActionLog(patient.id, initialMessages)

  const workContext = getWorkContext({
    globalStatus,
    role: userRole,
    patientName: patient.patient_name,
    quoteAmount: patient.quote_amount,
    proposedDate: patient.proposed_date,
    quoteAccepted: patient.quote_accepted,
    dateAccepted: patient.date_accepted,
    assignedSurgeonName: patient.assigned_surgeon?.full_name,
    progressDetail: patient.clinical_summary,
  })

  const handleAction = async (actionId: string, data?: Record<string, unknown>) => {
    try {
      const response = await fetch(`/api/patients/${patient.id}/change-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId, data }),
      })

      if (!response.ok) {
        throw new Error('Failed to execute action')
      }

      const result = await response.json()

      if (result.patient && Object.keys(result.patient).length > 0) {
        setPatient((currentPatient) => ({
          ...currentPatient,
          ...result.patient,
        }))
      }

      router.refresh()
    } catch (error) {
      console.error('Action failed:', error)
      alert("Une erreur est survenue lors de l'exécution de l'action")
    }
  }

  const handleUpdateSummary = async (summary: string, link: string) => {
    const response = await fetch(`/api/patients/${patient.id}/update-summary`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clinical_summary: summary,
        sharepoint_link: link,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to update summary')
    }

    setPatient({
      ...patient,
      clinical_summary: summary,
      sharepoint_link: link,
    })
  }

  const rightColumn = (
    <div className="space-y-5">
      <PatientActionPanel
        globalStatus={globalStatus}
        userRole={userRole}
        patientId={patient.id}
        actionTitle={workContext?.actionTitle ?? 'Dossier en cours de traitement'}
        quoteAmount={patient.quote_amount}
        proposedDate={patient.proposed_date}
        quoteAccepted={patient.quote_accepted}
        dateAccepted={patient.date_accepted}
        assignedSurgeonId={patient.assigned_surgeon_id}
        surgeons={surgeons}
        onAction={handleAction}
        onCommercialSaved={() => router.refresh()}
      />

      <QuestionnairePatientCard
        patientId={patient.id}
        patientEmail={patient.patient_email}
        questionnaireStatus={patient.questionnaire_status}
        questionnaireCompletedAt={patient.questionnaire_completed_at}
        questionnaireSummary={patient.questionnaire_summary}
        bridgeStatus={questionnaireStatus}
        canManage={canManageQuestionnaireEffective}
        initialLanguage={questionnaireLanguage}
        initialFormTypes={questionnaireFormTypes}
        onPrepareLink={prepareQuestionnaireLink}
        onRevokeLink={revokeQuestionnaireLink}
        showPdfDownload={viewConfig.showQuestionnairePdf}
      />

      <QuestionnaireDispatchModal
        open={Boolean(dispatchPayload)}
        payload={dispatchPayload}
        confirming={dispatchConfirming}
        onConfirmSent={confirmQuestionnaireDispatch}
        onClose={() => setDispatchPayload(null)}
      />

      {(patient.patient_email || patient.patient_phone) && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 bg-[#1E2B70] text-white text-xs font-extrabold uppercase tracking-widest">
            Contact patient
          </div>
          <div className="p-4 grid grid-cols-2 gap-2.5">
            {patient.patient_email && (
              <a
                href={`mailto:${patient.patient_email}`}
                className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-colors bg-[#F4EFDF] text-[#1E2B70] border border-[#E8E0D4] hover:bg-[#E8E0D4]"
              >
                <Mail size={14} />
                Email
              </a>
            )}
            {patient.patient_phone && (
              <a
                href={`tel:${patient.patient_phone}`}
                className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-colors bg-[#F4EFDF] text-[#1E2B70] border border-[#E8E0D4] hover:bg-[#E8E0D4]"
              >
                <Phone size={14} />
                Appel
              </a>
            )}
          </div>
        </div>
      )}

      <WorkflowActionHistory
        messages={actionLogMessages}
        assignedSurgeonName={patient.assigned_surgeon?.full_name}
      />

      <div className="bg-[#EBF0FA] border border-[#1E2B70]/20 rounded-xl p-4 text-sm text-[#1E2B70]">
        <p>
          <span className="font-semibold">Créé par :</span> {patient.creator.full_name}
        </p>
        <p className="mt-1">
          <span className="font-semibold">Date :</span>{' '}
          {new Date(patient.created_at).toLocaleDateString('fr-FR')}
        </p>
      </div>
    </div>
  )

  return (
    <div className="anamneze-dashboard min-h-[calc(100dvh-4rem)]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <PatientPageHeader
          patientName={patient.patient_name}
          patientEmail={patient.patient_email}
          patientPhone={patient.patient_phone}
          createdAt={patient.created_at}
          globalStatus={globalStatus}
          statusLabel={patient.current_status.label}
          statusColor={patient.current_status.color}
          dateAccepted={patient.date_accepted}
          progressDetail={patient.clinical_summary}
        />

        {workContext && <PatientWorkContextBanner context={workContext} />}

        {createQuestionnaireWarning && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 sm:p-4 mb-4" role="alert">
            <p className="text-xs sm:text-sm text-amber-900">{createQuestionnaireWarning}</p>
          </div>
        )}

        {questionnaireLinkNotice && (
          <div
            className={`rounded-lg p-3 sm:p-4 mb-4 border ${
              questionnaireLinkNotice.tone === 'success'
                ? 'bg-emerald-50 border-emerald-200'
                : questionnaireLinkNotice.tone === 'warning'
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-red-50 border-red-200'
            }`}
            role="alert"
          >
            <p
              className={`text-xs sm:text-sm ${
                questionnaireLinkNotice.tone === 'success'
                  ? 'text-emerald-900'
                  : questionnaireLinkNotice.tone === 'warning'
                    ? 'text-amber-900'
                    : 'text-red-900'
              }`}
            >
              {questionnaireLinkNotice.message}
            </p>
          </div>
        )}

        {/* Mobile: actions (dont réassignation chirurgien) avant Anamneze */}
        <div className="xl:hidden mb-5">{rightColumn}</div>

        {viewConfig.showAnamnezeDashboard && (
          <div className="mb-5">
            <AnamnezeSection
              patientId={patient.id}
              patientName={patient.patient_name}
              questionnaireStatus={patient.questionnaire_status}
              initialPreview={synthesisPreview}
              initialError={synthesisPreviewError}
              sessionId={latestCompletedSession?.id ?? null}
            />
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-5">
          <div className="space-y-5">
            <PatientDossierIdentityCard
              questionnaireLanguage={questionnaireLanguage}
              formTypes={questionnaireFormTypes}
              parcoursLabel={synthesisPreview?.spineRegionLabel}
              clinicalSummary={patient.clinical_summary}
              showClinicalSummary={viewConfig.showClinicalSummary && !viewConfig.showSharePoint}
              showCommercialData={showCommercialData}
              quoteAmount={patient.quote_amount}
              proposedDate={patient.proposed_date}
              quoteAccepted={patient.quote_accepted}
              dateAccepted={patient.date_accepted}
              assignedSurgeonName={patient.assigned_surgeon?.full_name}
            />

            {viewConfig.showSharePoint && (
              <PatientSummaryCard
                patientName={patient.patient_name}
                clinicalSummary={patient.clinical_summary}
                sharepointLink={patient.sharepoint_link}
                globalStatus={globalStatus}
                userRole={userRole}
                showSharePoint={viewConfig.showSharePoint}
                onUpdate={handleUpdateSummary}
              />
            )}

            <DocumentsSection patientId={patient.id} canManage={canManageDocumentsEffective} />

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 bg-[#1E2B70] border-b border-[#171F52]">
                <h2 className="text-xs font-extrabold uppercase tracking-widest text-white">
                  Notes & messages
                </h2>
              </div>
              <div className="p-4 sm:p-6 space-y-4">
                <MessageThread patientId={patient.id} initialMessages={medicalMessages} />
                {!isReadOnly && (
                  <div className="pt-4 border-t border-gray-200">
                    <h3 className="text-sm font-medium text-gray-900 mb-3">Ajouter un message</h3>
                    <Suspense fallback={<LoadingSpinner />}>
                      <MessageComposer patientId={patient.id} topic="medical" />
                    </Suspense>
                  </div>
                )}

                {commercialMessages.length > 0 && (
                  <div className="pt-4 border-t border-gray-200">
                    <h3 className="text-sm font-medium text-gray-900 mb-4">Messages commerciaux</h3>
                    <MessageThread patientId={patient.id} initialMessages={commercialMessages} />
                    {!isReadOnly && (
                      <div className="pt-4 border-t border-gray-200">
                        <Suspense fallback={<LoadingSpinner />}>
                          <MessageComposer patientId={patient.id} topic="commercial" />
                        </Suspense>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="hidden xl:block">
            <div className="sticky top-20">{rightColumn}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
