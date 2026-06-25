'use client'

import { useState, lazy, Suspense, useEffect } from 'react'
import { WorkflowActions, type SurgeonOption } from '@/components/workflow-actions'
import MessageThread, { type Message } from '@/components/patient/message-thread'
import WorkflowTimeline from '@/components/workflow-timeline'
import PatientSummaryCard from '@/components/patient-summary-card'
import DocumentsSection from '@/components/patient/documents-section'
import QuestionnairePatientCard from '@/components/patient/questionnaire-patient-card'
import AnamnezeSection from '@/components/patient/synthesis/anamneze-section'
import { globalStatusFromWorkflowStatus, type GlobalStatus, type UserRole } from '@/lib/workflow-v2'
import { getPatientDetailViewConfig } from '@/lib/patient-detail-view-config'
import type { QuestionnaireStatus } from '@/lib/integrations/questionnaire-portal'
import type { QuestionnaireSynthesisPreview } from '@/lib/integrations/questionnaire-synthesis-preview.types'
import {
  type QuestionnaireFormType,
  coercePatientFormTypes,
  normalizeFormTypes,
} from '@/lib/integrations/questionnaire-form-types'
import { useRouter } from 'next/navigation'

const MessageComposer = lazy(() => import('@/components/patient/message-composer'))
const CommercialData = lazy(() => import('@/components/patient/commercial-data'))

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
  const [activeTab, setActiveTab] = useState<'medical' | 'commercial'>('medical')
  const [questionnaireLanguage, setQuestionnaireLanguage] = useState<'fr' | 'en'>(
    initialPatient.questionnaire_language === 'en' ? 'en' : 'fr',
  )
  const [createQuestionnaireWarning, setCreateQuestionnaireWarning] = useState<string | null>(null)
  const [questionnaireLinkNotice, setQuestionnaireLinkNotice] = useState<{
    tone: 'success' | 'warning' | 'error'
    message: string
  } | null>(null)

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

  const sendQuestionnaireLink = async (formTypes: QuestionnaireFormType[], language: 'fr' | 'en') => {
    try {
      const response = await fetch(`/api/patients/${patient.id}/questionnaire-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, formTypes }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Échec de l'émission du lien")
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
      if (data.emailSent) {
        setQuestionnaireLinkNotice({
          tone: 'success',
          message: 'Lien questionnaire envoyé au patient par email.',
        })
      } else {
        setQuestionnaireLinkNotice({
          tone: 'warning',
          message:
            "Lien questionnaire généré mais l'email n'a pas été expédié. Vérifiez l'adresse du patient et la configuration Resend côté questionnaires (RESEND_API_KEY). Réessayez avec un des boutons d'envoi.",
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

  const medicalMessages = initialMessages.filter(m =>
    m.topic === 'medical' || m.topic === 'system' || !m.topic
  )

  const commercialMessages = initialMessages.filter(m =>
    m.topic === 'commercial'
  )

  const showCommercialTab = viewConfig.showCommercialTab
  const isReadOnly = globalStatus === 'rejected' && userRole !== 'admin'
  const latestCompletedSession = questionnaireStatus?.sessions?.find((s) => s.status === 'completed')

  const handleAction = async (actionId: string, data?: any) => {
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
        setPatient(currentPatient => ({
          ...currentPatient,
          ...result.patient,
        }))
      }

      router.refresh()
    } catch (error) {
      console.error('Action failed:', error)
      alert('Une erreur est survenue lors de l\'exécution de l\'action')
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

  return (
    <div className="anamneze-dashboard min-h-[calc(100dvh-4rem)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        <WorkflowTimeline currentStatus={globalStatus} />

        {isReadOnly && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
            <p className="text-xs sm:text-sm text-yellow-800">
              ⚠️ Ce dossier est en lecture seule. Seul un administrateur peut effectuer des modifications.
            </p>
          </div>
        )}

        {createQuestionnaireWarning && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6" role="alert">
            <p className="text-xs sm:text-sm text-amber-900">{createQuestionnaireWarning}</p>
          </div>
        )}

        {questionnaireLinkNotice && (
          <div
            className={`rounded-lg p-3 sm:p-4 mb-4 sm:mb-6 border ${
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

        {viewConfig.showAnamnezeDashboard && (
          <div className="mb-4 sm:mb-6">
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

        <div className="lg:hidden mb-4 space-y-4">
        <div className="bg-white rounded-xl shadow-sm border-2 border-gray-200 p-4">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Actions disponibles</h2>
          <WorkflowActions
            globalStatus={globalStatus}
            userRole={userRole}
            quoteAccepted={patient.quote_accepted || false}
            dateAccepted={patient.date_accepted || false}
            surgeons={surgeons}
            onAction={handleAction}
          />
        </div>

        <QuestionnairePatientCard
          patientId={patient.id}
          patientEmail={patient.patient_email}
          questionnaireStatus={patient.questionnaire_status}
          questionnaireCompletedAt={patient.questionnaire_completed_at}
          questionnaireSummary={patient.questionnaire_summary}
          bridgeStatus={questionnaireStatus}
          canManage={canManageQuestionnaire}
          initialLanguage={questionnaireLanguage}
          initialFormTypes={questionnaireFormTypes}
          onSendLink={sendQuestionnaireLink}
          onRevokeLink={revokeQuestionnaireLink}
          showPdfDownload={viewConfig.showQuestionnairePdf}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
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

          <DocumentsSection patientId={patient.id} canManage={viewConfig.canManageDocuments} />

          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="border-b border-gray-200">
              <nav className="flex -mb-px">
                <button
                  onClick={() => setActiveTab('medical')}
                  className={`flex-1 sm:flex-none px-4 sm:px-6 py-3 text-sm font-medium border-b-2 transition ${
                    activeTab === 'medical'
                      ? 'border-[#2563EB] text-[#2563EB]'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Santé
                </button>
                {showCommercialTab && (
                  <button
                    onClick={() => setActiveTab('commercial')}
                    className={`flex-1 sm:flex-none px-4 sm:px-6 py-3 text-sm font-medium border-b-2 transition ${
                      activeTab === 'commercial'
                        ? 'border-[#2563EB] text-[#2563EB]'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Devis & Planning
                  </button>
                )}
              </nav>
            </div>

            <div className="p-4 sm:p-6">
              {activeTab === 'medical' && (
                <div className="space-y-4">
                  <MessageThread
                    patientId={patient.id}
                    initialMessages={medicalMessages}
                  />
                  {!isReadOnly && (
                    <div className="pt-4 border-t border-gray-200">
                      <h3 className="text-sm font-medium text-gray-900 mb-3">Ajouter un message</h3>
                      <Suspense fallback={<LoadingSpinner />}>
                        <MessageComposer patientId={patient.id} topic="medical" />
                      </Suspense>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'commercial' && showCommercialTab && (
                <div className="space-y-4 sm:space-y-6">
                  <Suspense fallback={<LoadingSpinner />}>
                    <CommercialData
                      patientId={patient.id}
                      initialQuoteAmount={patient.quote_amount}
                      initialProposedDate={patient.proposed_date}
                      canEdit={userRole === 'marcel' || userRole === 'franchir' || userRole === 'admin'}
                    />
                  </Suspense>

                  <div className="border-t border-gray-200 pt-4 sm:pt-6">
                    <h3 className="text-sm font-medium text-gray-900 mb-4">Messages commerciaux</h3>
                    {commercialMessages.length > 0 ? (
                      <>
                        <MessageThread
                          patientId={patient.id}
                          initialMessages={commercialMessages}
                        />
                        {!isReadOnly && (
                          <div className="pt-4 border-t border-gray-200">
                            <Suspense fallback={<LoadingSpinner />}>
                              <MessageComposer patientId={patient.id} topic="commercial" />
                            </Suspense>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-6 sm:py-8">
                        <p className="text-sm text-gray-500 mb-4">
                          Aucun message commercial pour le moment
                        </p>
                        {!isReadOnly && (
                          <div className="max-w-md mx-auto">
                            <Suspense fallback={<LoadingSpinner />}>
                              <MessageComposer patientId={patient.id} topic="commercial" />
                            </Suspense>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="hidden lg:block lg:col-span-1">
          <div className="sticky top-20 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border-2 border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-5">Actions disponibles</h2>
              <WorkflowActions
                globalStatus={globalStatus}
                userRole={userRole}
                quoteAccepted={patient.quote_accepted || false}
                dateAccepted={patient.date_accepted || false}
                surgeons={surgeons}
                onAction={handleAction}
              />
            </div>

            <QuestionnairePatientCard
              patientId={patient.id}
              patientEmail={patient.patient_email}
              questionnaireStatus={patient.questionnaire_status}
              questionnaireCompletedAt={patient.questionnaire_completed_at}
              questionnaireSummary={patient.questionnaire_summary}
              bridgeStatus={questionnaireStatus}
              canManage={canManageQuestionnaire}
              initialLanguage={questionnaireLanguage}
              initialFormTypes={questionnaireFormTypes}
              onSendLink={sendQuestionnaireLink}
              onRevokeLink={revokeQuestionnaireLink}
              showPdfDownload={viewConfig.showQuestionnairePdf}
            />

            <div className="bg-blue-100 border-2 border-blue-300 rounded-xl p-4">
              <h3 className="text-base font-bold text-blue-950 mb-2">Informations</h3>
              <div className="space-y-2 text-sm text-blue-900">
                <p>
                  <span className="font-semibold">Créé par:</span> {patient.creator.full_name}
                </p>
                <p>
                  <span className="font-semibold">Date:</span>{' '}
                  {new Date(patient.created_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  )
}
