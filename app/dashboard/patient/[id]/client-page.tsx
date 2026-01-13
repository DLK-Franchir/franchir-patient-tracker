'use client'

import { useState } from 'react'
import { WorkflowGuidance } from '@/components/workflow-guidance'
import { WorkflowActions } from '@/components/workflow-actions'
import MessageThread, { type Message } from '@/components/patient/message-thread'
import MessageComposer from '@/components/patient/message-composer'
import WorkflowTimeline from '@/components/workflow-timeline'
import PatientSummaryCard from '@/components/patient-summary-card'
import { globalStatusFromWorkflowStatus, type GlobalStatus, type UserRole } from '@/lib/workflow-v2'
import { useRouter } from 'next/navigation'

interface PatientData {
  id: string
  patient_name: string
  clinical_summary: string | null
  sharepoint_link: string | null
  created_at: string
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
  const [messages, setMessages] = useState(initialMessages)

  const globalStatus: GlobalStatus = globalStatusFromWorkflowStatus(patient.current_status)

  const medicalMessages = messages.filter(m =>
    m.topic === 'medical' || m.topic === 'system' || !m.topic
  )

  const commercialMessages = messages.filter(m =>
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
            patientId={patient.id}
            onUpdate={handleUpdateSummary}
          />

          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="border-b border-gray-200">
              <nav className="flex -mb-px">
                <button
                  className="px-6 py-3 text-sm font-medium border-b-2 border-[#2563EB] text-[#2563EB]"
                >
                  Santé
                </button>
                {showCommercialTab && (
                  <button
                    className="px-6 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent"
                  >
                    Devis & Planning
                  </button>
                )}
              </nav>
            </div>

            <div className="p-6">
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
                  quoteAccepted={false}
                  dateAccepted={false}
                  onAction={handleAction}
                />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Historique</h2>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {medicalMessages.slice(-5).reverse().map((msg) => (
                  <div key={msg.id} className="text-sm border-l-2 border-gray-200 pl-3 py-2">
                    <p className="font-medium text-gray-900">{msg.title || msg.author_name}</p>
                    <p className="text-gray-600 text-xs mt-1">
                      {new Date(msg.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
