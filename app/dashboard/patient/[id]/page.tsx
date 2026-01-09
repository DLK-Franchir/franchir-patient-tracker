import { createServerClient } from '@/lib/supabase/server'
import { BadgeStatus } from '@/components/ui/badge-status'
import WorkflowActions from './workflow-actions'
import QuoteCard from '@/components/patient/quote-card'
import CalendarEventForm from '@/components/patient/calendar-event-form'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function PatientDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createServerClient()

  const { data: patient } = await supabase
    .from('patients')
    .select(`
      *,
      workflow_statuses (*),
      profiles (full_name, role)
    `)
    .eq('id', params.id)
    .single()

  if (!patient) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm mb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-xl font-bold text-gray-900">FRANCHIR - Dossier Patient</h1>
            <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">
              ← Retour au tableau
            </Link>
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
              <h3 className="font-bold text-lg mb-4">Historique & Décisions</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3 text-sm">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5"></div>
                  <div>
                    <p className="text-gray-600">
                      <span className="font-medium">{patient.profiles.full_name}</span> a créé le dossier
                    </p>
                    <p className="text-gray-400 text-xs">{new Date(patient.created_at).toLocaleString()}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-500 italic pl-5">
                  L'historique complet des décisions sera affiché ici...
                </p>
              </div>
            </section>

            <section className="bg-white p-6 rounded-lg shadow">
              <h3 className="font-bold text-lg mb-4">Devis</h3>
              <QuoteCard patientId={patient.id} />
            </section>

            <section className="bg-white p-6 rounded-lg shadow">
              <h3 className="font-bold text-lg mb-4">Date de chirurgie</h3>
              <CalendarEventForm patientId={patient.id} />
            </section>
          </div>

          <div className="space-y-6">
            <WorkflowActions patientId={patient.id} currentStatus={patient.workflow_statuses} />
          </div>
        </div>
      </div>
    </div>
  )
}
