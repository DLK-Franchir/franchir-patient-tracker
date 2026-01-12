import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { can, type Role } from '@/lib/permissions'
import NotificationBell from '@/components/notifications/notification-bell'
import LogoutButton from '@/components/auth/logout-button'

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
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">Tableau de Suivi FRANCHIR</h1>
            <p className="text-sm text-gray-600 mt-1">
              Connecté : {profile?.full_name} ({profile?.email}) - Rôle : <span className="font-semibold">{userRole}</span>
            </p>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell />
            {can(userRole, 'CREATE_PATIENT') && (
              <Link
                href="/dashboard/new"
                className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-indigo-700 shadow-md transition-all"
              >
                + Nouveau Patient
              </Link>
            )}
            <LogoutButton />
          </div>
        </div>

        <div className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Patient</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Statut</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Créé par</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{(patient.profiles as any)?.full_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(patient.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link 
                      href={`/dashboard/patient/${patient.id}`} 
                      className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 px-3 py-2 rounded-md"
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
      </div>
    </div>
  )
}
