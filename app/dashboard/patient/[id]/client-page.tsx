'use client'

import { useState } from 'react'
import { WorkflowGuidance } from '@/components/workflow-guidance'
import { WorkflowActions } from '@/components/workflow-actions'
import MessageThread, { type Message } from '@/components/patient/message-thread'
import MessageComposer from '@/components/patient/message-composer'
import WorkflowTimeline from '@/components/workflow-timeline'
import PatientSummaryCard from '@/components/patient-summary-card'
import CommercialData from '@/components/patient/commercial-data'
import { globalStatusFromWorkflowStatus, type GlobalStatus, type UserRole } from '@/lib/workflow-v2'
import { useRouter } from 'next/navigation'

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

  console.log('📄 [PatientDetailClient] Rendering with:', {
    patientId: patient.id,
    patientName: patient.patient_name,
    currentStatusCode: patient.current_status?.code,
    currentStatusLabel: patient.current_status?.label,
    globalStatus,
    userRole
  })

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

      window.location.reload()
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <WorkflowTimeline currentStatus={globalStatus} />

      {isReadOnly && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-yellow-800">
            ⚠️ Ce dossier est en lecture seule. Seul un administrateur peut effectuer des modifications.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
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
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition ${
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
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition ${
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

            <div className="p-6">
              {activeTab === 'medical' && (
                <div className="space-y-4">
                  <MessageThread
                    patientId={patient.id}
                    initialMessages={medicalMessages}
                  />
                  {!isReadOnly && (
                    <div className="pt-4 border-t border-gray-200">
                      <h3 className="text-sm font-medium text-gray-900 mb-3">Ajouter un message</h3>
                      <MessageComposer patientId={patient.id} topic="medical" />
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'commercial' && showCommercialTab && (
                <div className="space-y-6">
                  <CommercialData
                    patientId={patient.id}
                    initialQuoteAmount={patient.quote_amount}
                    initialProposedDate={patient.proposed_date}
                    canEdit={userRole === 'marcel' || userRole === 'franchir' || userRole === 'admin'}
                  />

                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-sm font-medium text-gray-900 mb-4">Messages commerciaux</h3>
                    {commercialMessages.length > 0 ? (
                      <>
                        <MessageThread
                          patientId={patient.id}
                          initialMessages={commercialMessages}
                        />
                        {!isReadOnly && (
                          <div className="pt-4 border-t border-gray-200">
                            <MessageComposer patientId={patient.id} topic="commercial" />
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-sm text-gray-500 mb-4">
                          Aucun message commercial pour le moment
                        </p>
                        {!isReadOnly && (
                          <div className="max-w-md mx-auto">
                            <MessageComposer patientId={patient.id} topic="commercial" />
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

        <div className="lg:col-span-1">
          <div className="sticky top-24 space-y-6">
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

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Historique</h2>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {medicalMessages.slice(-5).reverse().map((msg) => {
                  const date = new Date(msg.created_at)

                  return (
                    <div key={msg.id} className="text-sm border-l-2 border-gray-200 pl-3 py-2">
                      <p className="font-medium text-gray-900">{msg.title || msg.author_name}</p>
                      <p className="text-gray-600 text-xs mt-1" suppressHydrationWarning>
                        {date.getDate()} {date.toLocaleDateString('fr-FR', { month: 'short' })} à {date.getHours().toString().padStart(2, '0')}:{date.getMinutes().toString().padStart(2, '0')}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
