import { createServerClient } from '@/lib/supabase/server'
import { BadgeStatus } from '@/components/ui/badge-status'
import WorkflowActions from './workflow-actions'
import QuoteCard from '@/components/patient/quote-card'
import CalendarEventForm from '@/components/patient/calendar-event-form'
import MessageThread from '@/components/patient/message-thread'
import MessageComposer from '@/components/patient/message-composer'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { can, type Role } from '@/lib/permissions'
import NotificationBell from '@/components/notifications/notification-bell'

export default async function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: currentUserProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id)
    .single()

  const userRole = currentUserProfile?.role as Role

  const { data: patient } = await supabase
    .from('patients')
    .select(`
      *,
      workflow_statuses (*),
      profiles (full_name, role)
    `)
    .eq('id', id)
    .single()

  if (!patient) {
    redirect('/dashboard')
  }

  const { data: messages } = await supabase
    .from('patient_messages')
    .select('*')
    .eq('patient_id', id)
    .order('created_at', { ascending: true })

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm mb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-xl font-bold text-gray-900">FRANCHIR - Dossier Patient</h1>
            <div className="flex items-center gap-4">
              <NotificationBell />
              <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">
                ← Retour au tableau
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">{patient.patient_name}</h2>
            <div className="mt-2 flex items-center gap-3">
              <BadgeStatus status={patient.workflow_statuses} />
              <span className="text-gray-500 text-sm">
                Créé par {patient.profiles.full_name} le {new Date(patient.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
          <a 
            href={patient.sharepoint_link} 
            target="_blank"
            rel="noopener noreferrer"
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md border hover:bg-gray-200 flex items-center gap-2"
          >
            Ouvrir SharePoint
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-6">
            <section className="bg-white p-6 rounded-lg shadow">
              <h3 className="font-bold text-lg mb-3">Résumé Clinique</h3>
              <p className="text-gray-700 whitespace-pre-wrap">
                {patient.clinical_summary || "Aucun résumé fourni."}
              </p>
            </section>

            <section className="bg-white p-6 rounded-lg shadow">
              <h3 className="font-bold text-lg mb-4">Messages & Historique</h3>
              <MessageThread
                patientId={patient.id}
                initialMessages={messages || []}
              />
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h4 className="font-medium text-gray-900 mb-3">Écrire un message</h4>
                <MessageComposer patientId={patient.id} />
              </div>
            </section>

            {can(userRole, 'EDIT_QUOTE') && (
              <section className="bg-white p-6 rounded-lg shadow">
                <h3 className="font-bold text-lg mb-4">Devis</h3>
                <QuoteCard patientId={patient.id} />
              </section>
            )}

            {can(userRole, 'SCHEDULE_SURGERY') && (
              <section className="bg-white p-6 rounded-lg shadow">
                <h3 className="font-bold text-lg mb-4">Date de chirurgie</h3>
                <CalendarEventForm patientId={patient.id} />
              </section>
            )}
          </div>

          <div className="space-y-6">
            <WorkflowActions patientId={patient.id} currentStatus={patient.workflow_statuses} userRole={userRole} />
          </div>
        </div>
      </div>
    </div>
  )
}
