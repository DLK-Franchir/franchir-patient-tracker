import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { can, type Role } from '@/lib/permissions'
import NotificationBell from '@/components/notifications/notification-bell'
import AppHeader from '@/components/app-header'

export default async function DashboardPage() {
  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user?.id)
    .single()

  const userRole = profile?.role as Role

  const { data: patients } = await supabase
    .from('patients')
    .select(`
      id,
      patient_name,
      created_at,
      workflow_statuses (label, color),
      profiles (full_name)
    `)
    .order('created_at', { ascending: false })

  return (
    <>
      <AppHeader userRole={userRole} userName={profile?.full_name} showActions={true} />
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">Tableau de Suivi FRANCHIR</h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                Connecté : {profile?.full_name} - <span className="font-semibold">{userRole}</span>
              </p>
            </div>
            <div className="flex items-center gap-4">
              <NotificationBell />
            </div>
          </div>

          <div className="hidden md:block bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Patient</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Statut</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Créé par</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {patients?.map((patient) => (
                  <tr key={patient.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-900">{patient.patient_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span 
                        className="px-3 py-1 rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: (patient.workflow_statuses as any)?.color || '#6B7280' }}
                      >
                        {(patient.workflow_statuses as any)?.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{(patient.profiles as any)?.full_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(patient.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link 
                        href={`/dashboard/patient/${patient.id}`} 
                        className="text-[#2563EB] hover:text-[#1d4ed8] bg-blue-50 px-3 py-2 rounded-md font-medium transition"
                      >
                        Voir dossier →
                      </Link>
                    </td>
                  </tr>
                ))}
                {(!patients || patients.length === 0) && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500 italic">
                      Aucun dossier patient pour le moment.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {patients?.map((patient) => (
              <Link
                key={patient.id}
                href={`/dashboard/patient/${patient.id}`}
                className="block bg-white shadow-sm border border-gray-200 rounded-xl p-4 hover:shadow-md transition active:bg-gray-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{patient.patient_name}</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {(patient.profiles as any)?.full_name} • {new Date(patient.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <span 
                    className="px-2.5 py-1 rounded-full text-xs font-bold text-white shrink-0"
                    style={{ backgroundColor: (patient.workflow_statuses as any)?.color || '#6B7280' }}
                  >
                    {(patient.workflow_statuses as any)?.label}
                  </span>
                </div>
              </Link>
            ))}
            {(!patients || patients.length === 0) && (
              <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-8 text-center text-gray-500 italic">
                Aucun dossier patient pour le moment.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
