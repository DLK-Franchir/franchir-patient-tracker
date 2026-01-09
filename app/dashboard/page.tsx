import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BadgeStatus } from '@/components/ui/badge-status'
import SurgeryCalendar from '@/components/calendar/surgery-calendar'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createServerClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single()

  const { data: patients } = await supabase
    .from('patients')
    .select(`
      *,
      workflow_statuses (label, color),
      profiles (full_name)
    `)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-xl font-bold text-gray-900">FRANCHIR - Tableau de bord</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {profile?.full_name} ({profile?.role})
              </span>
              <form action="/auth/signout" method="post">
                <button className="text-sm text-red-600 hover:text-red-800">
                  Déconnexion
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <div className="lg:col-span-2">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Tableau Partagé des Patients</h2>
              <Link
                href="/dashboard/new"
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
              >
                + Nouveau Patient
              </Link>
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Créé par</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {patients && patients.length > 0 ? (
                    patients.map((patient) => (
                      <tr key={patient.id}>
                        <td className="px-6 py-4 font-medium">{patient.patient_name}</td>
                        <td className="px-6 py-4">
                          <BadgeStatus status={patient.workflow_statuses} />
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">{patient.profiles?.full_name}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {new Date(patient.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <Link href={`/dashboard/patient/${patient.id}`} className="text-indigo-600 hover:text-indigo-900">
                            Voir dossier
                          </Link>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                        Aucun patient pour le moment. Cliquez sur &quot;+ Nouveau Patient&quot; pour commencer.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <SurgeryCalendar />
          </div>
        </div>
      </main>
    </div>
  )
}
