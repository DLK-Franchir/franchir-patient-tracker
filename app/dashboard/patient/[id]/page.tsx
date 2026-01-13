import { createServerClient } from '@/lib/supabase/server'
import WorkflowActions from './workflow-actions'
import MessageThread from '@/components/patient/message-thread'
import MessageComposer from '@/components/patient/message-composer'
import { redirect } from 'next/navigation'
import FranchirHeader from '@/components/franchir-header'
import WorkflowTimeline from '@/components/workflow-timeline'
import { globalStatusFromWorkflowStatus, type GlobalStatus } from '@/lib/workflow-v2'

export default async function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  const userRole = profile.role as 'marcel' | 'franchir' | 'gilles' | 'admin'

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

  const globalStatus: GlobalStatus = globalStatusFromWorkflowStatus(patient.current_status)

  const { data: allMessages } = await supabase
    .from('patient_messages')
    .select('*')
    .eq('patient_id', id)
    .order('created_at', { ascending: true })

  const medicalMessages = (allMessages || []).filter(m =>
    m.topic === 'medical' || m.topic === 'system' || !m.topic
  )

  const commercialMessages = (allMessages || []).filter(m =>
    m.topic === 'commercial'
  )

  const showCommercialTab = userRole !== 'gilles'
  const isReadOnly = globalStatus === 'rejected' && userRole !== 'admin'

  return (
    <div className="min-h-screen bg-gray-50">
      <FranchirHeader />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{patient.patient_name}</h1>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>Créé par {patient.creator?.full_name || 'Inconnu'}</span>
            <span>•</span>
            <span>{new Date(patient.created_at).toLocaleDateString('fr-FR')}</span>
            {patient.sharepoint_link && (
              <>
                <span>•</span>
                <a
                  href={patient.sharepoint_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#0066CC] hover:underline flex items-center gap-1"
                >
                  SharePoint
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </>
            )}
          </div>
        </div>

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
            <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Résumé clinique</h2>
              <div className="prose prose-sm max-w-none text-gray-700">
                {patient.clinical_summary || (
                  <p className="text-gray-400 italic">Aucun résumé clinique fourni.</p>
                )}
              </div>
            </section>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="border-b border-gray-200">
                <nav className="flex -mb-px">
                  <button
                    className="px-6 py-3 text-sm font-medium border-b-2 border-[#0066CC] text-[#0066CC]"
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
            <div className="sticky top-24">
              <WorkflowActions
                patientId={patient.id}
                currentStatus={patient.current_status}
                globalStatus={globalStatus}
                userRole={userRole}
                isReadOnly={isReadOnly}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
