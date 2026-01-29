'use client'

import { useState, lazy, Suspense } from 'react'
import { WorkflowGuidance } from '@/components/workflow-guidance'
import { WorkflowActions } from '@/components/workflow-actions'
import MessageThread, { type Message } from '@/components/patient/message-thread'
import WorkflowTimeline from '@/components/workflow-timeline'
import PatientSummaryCard from '@/components/patient-summary-card'
import { globalStatusFromWorkflowStatus, type GlobalStatus, type UserRole } from '@/lib/workflow-v2'
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
  clinical_summary: string | null
  sharepoint_link: string | null
  created_at: string
  quote_amount?: number | null
  proposed_date?: string | null
  quote_accepted?: boolean
  date_accepted?: boolean
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
}: {
  initialPatient: PatientData
  initialMessages: Message[]
  userRole: UserRole
}) {
  const router = useRouter()
  const [patient, setPatient] = useState(initialPatient)
  const [activeTab, setActiveTab] = useState<'medical' | 'commercial'>('medical')

  const globalStatus: GlobalStatus = globalStatusFromWorkflowStatus(patient.current_status)

  const medicalMessages = initialMessages.filter(m =>
    m.topic === 'medical' || m.topic === 'system' || !m.topic
  )

  const commercialMessages = initialMessages.filter(m =>
    m.topic === 'commercial'
  )

  const showCommercialTab = userRole !== 'gilles'
  const isReadOnly = globalStatus === 'rejected' && userRole !== 'admin'

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
              onAction={handleAction}
            />
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
            onUpdate={handleUpdateSummary}
          />

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
                  onAction={handleAction}
                />
              </div>
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
