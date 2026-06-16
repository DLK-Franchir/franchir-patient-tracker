'use client'

import { useState, lazy, Suspense } from 'react'
import { WorkflowGuidance } from '@/components/workflow-guidance'
import { WorkflowActions, type SurgeonOption } from '@/components/workflow-actions'
import MessageThread, { type Message } from '@/components/patient/message-thread'
import WorkflowTimeline from '@/components/workflow-timeline'
import PatientSummaryCard from '@/components/patient-summary-card'
import DocumentsSection from '@/components/patient/documents-section'
import SurgeonAssignmentCard from '@/components/patient/surgeon-assignment-card'
import { globalStatusFromWorkflowStatus, type GlobalStatus, type UserRole } from '@/lib/workflow-v2'
import { getPatientDetailViewConfig } from '@/lib/patient-detail-view-config'
import type { QuestionnaireStatus } from '@/lib/integrations/questionnaire-portal'
import QuestionnaireSynthesisPanel from '@/components/patient/questionnaire-synthesis-panel'
import { useRouter } from 'next/navigation'

function formatDateFr(iso: string | null | undefined): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('fr-FR')
}

const SESSION_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  draft: { label: 'À démarrer', cls: 'bg-slate-100 text-slate-600' },
  in_progress: { label: 'En cours', cls: 'bg-orange-100 text-orange-800' },
  completed: { label: 'Complété', cls: 'bg-green-100 text-green-800' },
}

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
}: {
  initialPatient: PatientData
  initialMessages: Message[]
  userRole: UserRole
  surgeons?: SurgeonOption[]
  questionnaireStatus?: QuestionnaireStatus | null
}) {
  const router = useRouter()
  const [patient, setPatient] = useState(initialPatient)
  const [activeTab, setActiveTab] = useState<'medical' | 'commercial'>('medical')
  const [questionnaireLoading, setQuestionnaireLoading] = useState(false)

  const viewConfig = getPatientDetailViewConfig(userRole)
  const canManageQuestionnaire = viewConfig.canManageQuestionnaire

  const handleQuestionnaireLink = async (newSession: boolean) => {
    setQuestionnaireLoading(true)
    try {
      const response = await fetch(`/api/patients/${patient.id}/questionnaire-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newSession }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Échec de l'émission du lien")
      }
      setPatient((p) => ({
        ...p,
        questionnaire_status: p.questionnaire_status === 'completed' ? 'completed' : 'sent',
      }))
      alert(
        data.emailSent
          ? 'Lien questionnaire envoyé au patient par email.'
          : 'Lien questionnaire généré (email non envoyé — vérifier la configuration email).'
      )
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Une erreur est survenue")
    } finally {
      setQuestionnaireLoading(false)
    }
  }

  const handleRevokeLink = async () => {
    if (!confirm('Révoquer le lien actif de ce patient ? Il ne pourra plus accéder au questionnaire avec ce lien.')) {
      return
    }
    setQuestionnaireLoading(true)
    try {
      const response = await fetch(`/api/patients/${patient.id}/questionnaire-revoke`, { method: 'POST' })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Échec de la révocation')
      }
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Une erreur est survenue')
    } finally {
      setQuestionnaireLoading(false)
    }
  }

  const globalStatus: GlobalStatus = globalStatusFromWorkflowStatus(patient.current_status)

  const medicalMessages = initialMessages.filter(m =>
    m.topic === 'medical' || m.topic === 'system' || !m.topic
  )

  const commercialMessages = initialMessages.filter(m =>
    m.topic === 'commercial'
  )

  const showCommercialTab = viewConfig.showCommercialTab
  const isReadOnly = globalStatus === 'rejected' && userRole !== 'admin'
  const canAssignSurgeon = viewConfig.showSurgeonAssignment

  const assignedSurgeon = patient.assigned_surgeon ?? null

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
      <WorkflowTimeline currentStatus={globalStatus} />

      {isReadOnly && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
          <p className="text-xs sm:text-sm text-yellow-800">
            ⚠️ Ce dossier est en lecture seule. Seul un administrateur peut effectuer des modifications.
          </p>
        </div>
      )}

      <div className="lg:hidden mb-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Actions disponibles</h2>
          <WorkflowGuidance globalStatus={globalStatus} userRole={userRole} />
          <div className="mt-3">
            <WorkflowActions
              globalStatus={globalStatus}
              userRole={userRole}
              quoteAccepted={patient.quote_accepted || false}
              dateAccepted={patient.date_accepted || false}
              surgeons={surgeons}
              onAction={handleAction}
            />
          </div>
          <div className="mt-4">
            {viewConfig.showSurgeonAssignment && (
            <SurgeonAssignmentCard
              patientId={patient.id}
              surgeons={surgeons}
              assignedSurgeon={assignedSurgeon}
              canManage={canAssignSurgeon && !isReadOnly}
              onAssigned={(surgeon) =>
                setPatient((current) => ({
                  ...current,
                  assigned_surgeon_id: surgeon.id,
                  assigned_surgeon: surgeon,
                }))
              }
            />
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          <PatientSummaryCard
            patientName={patient.patient_name}
            clinicalSummary={patient.clinical_summary}
            sharepointLink={patient.sharepoint_link}
            globalStatus={globalStatus}
            userRole={userRole}
            showSharePoint={viewConfig.showSharePoint}
            onUpdate={handleUpdateSummary}
          />

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
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions disponibles</h2>
              <WorkflowGuidance globalStatus={globalStatus} userRole={userRole} />
              <div className="mt-4">
                <WorkflowActions
                  globalStatus={globalStatus}
                  userRole={userRole}
                  quoteAccepted={patient.quote_accepted || false}
                  dateAccepted={patient.date_accepted || false}
                  surgeons={surgeons}
                  onAction={handleAction}
                />
              </div>
            </div>

            {viewConfig.showSurgeonAssignment && (
            <SurgeonAssignmentCard
              patientId={patient.id}
              surgeons={surgeons}
              assignedSurgeon={assignedSurgeon}
              canManage={canAssignSurgeon && !isReadOnly}
              onAssigned={(surgeon) =>
                setPatient((current) => ({
                  ...current,
                  assigned_surgeon_id: surgeon.id,
                  assigned_surgeon: surgeon,
                }))
              }
            />
            )}

            {viewConfig.showQuestionnairePdf && (
              <QuestionnaireSynthesisPanel
                patientId={patient.id}
                questionnaireStatus={patient.questionnaire_status}
                questionnaireCompletedAt={patient.questionnaire_completed_at}
                bridgeSessions={questionnaireStatus?.sessions}
              />
            )}

            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Questionnaire patient</h3>
              {patient.questionnaire_status === 'completed' ? (
                <div className="flex items-start gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Complété
                  </span>
                  {patient.questionnaire_completed_at && (
                    <span className="text-xs text-gray-500 mt-0.5">
                      le {new Date(patient.questionnaire_completed_at).toLocaleDateString('fr-FR')}
                    </span>
                  )}
                </div>
              ) : patient.questionnaire_status === 'sent' ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Lien envoyé — en attente de complétion
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                  En attente d&apos;envoi
                </span>
              )}
              {patient.patient_email && (
                <p className="text-xs text-gray-500 mt-2 break-all">
                  Patient : {patient.patient_email}
                </p>
              )}
              {patient.questionnaire_status === 'completed' && patient.questionnaire_summary && (
                <p className="text-xs text-gray-600 mt-2 whitespace-pre-line border-t border-gray-100 pt-2">
                  {patient.questionnaire_summary}
                </p>
              )}

              {canManageQuestionnaire && (
                patient.questionnaire_status === 'completed' ? (
                  // Règle métier (item 7) : questionnaire complété = non refaisable
                  // via un nouveau lien. Une nouvelle évaluation nécessite un
                  // nouveau dossier patient.
                  <div className="mt-3 border-t border-gray-100 pt-3">
                    <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                      Questionnaire complété — pour une nouvelle évaluation, créez un nouveau dossier patient.
                    </p>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                    <button
                      onClick={() => handleQuestionnaireLink(false)}
                      disabled={questionnaireLoading}
                      className="w-full text-sm bg-[#2563EB] text-white px-3 py-2 rounded-md font-medium hover:bg-[#1d4ed8] disabled:opacity-50 transition"
                    >
                      {questionnaireLoading
                        ? 'Envoi…'
                        : patient.questionnaire_status
                          ? 'Renvoyer le lien'
                          : 'Générer et envoyer le lien'}
                    </button>
                    {questionnaireStatus?.activeLink && (
                      <button
                        onClick={handleRevokeLink}
                        disabled={questionnaireLoading}
                        className="w-full text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-md disabled:opacity-50 transition"
                      >
                        Révoquer le lien actif
                      </button>
                    )}
                  </div>
                )
              )}

              {questionnaireStatus?.activeLink && (
                <div className="mt-3 border-t border-gray-100 pt-3 space-y-0.5 text-xs text-gray-500">
                  {formatDateFr(questionnaireStatus.activeLink.expiresAt) && (
                    <p>Expire le {formatDateFr(questionnaireStatus.activeLink.expiresAt)}</p>
                  )}
                  {formatDateFr(questionnaireStatus.activeLink.sentAt) && (
                    <p>Envoyé le {formatDateFr(questionnaireStatus.activeLink.sentAt)}</p>
                  )}
                  {formatDateFr(questionnaireStatus.activeLink.openedAt) && (
                    <p className="text-blue-700">Ouvert le {formatDateFr(questionnaireStatus.activeLink.openedAt)}</p>
                  )}
                  {formatDateFr(questionnaireStatus.activeLink.completedAt) && (
                    <p className="text-green-700">Complété le {formatDateFr(questionnaireStatus.activeLink.completedAt)}</p>
                  )}
                </div>
              )}

              {questionnaireStatus?.sessions && questionnaireStatus.sessions.length > 0 && (
                <div className="mt-3 border-t border-gray-100 pt-3">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Suivi longitudinal</p>
                  <ul className="space-y-1.5">
                    {questionnaireStatus.sessions.map((s) => {
                      const cfg = SESSION_STATUS_LABEL[s.status] ?? SESSION_STATUS_LABEL.draft
                      return (
                        <li key={s.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-gray-700 truncate">
                            {s.label}
                            {s.isActive && <span className="ml-1 text-[10px] text-blue-600">(actif)</span>}
                            <span className="block text-gray-400">
                              {formatDateFr(s.createdAt)}
                              {s.completedAt && ` · complété ${formatDateFr(s.completedAt)}`}
                            </span>
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium shrink-0 ${cfg.cls}`}>
                            {cfg.label}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">Informations</h3>
              <div className="space-y-2 text-xs text-blue-800">
                <p>
                  <span className="font-medium">Créé par:</span> {patient.creator.full_name}
                </p>
                <p>
                  <span className="font-medium">Date:</span>{' '}
                  {new Date(patient.created_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
