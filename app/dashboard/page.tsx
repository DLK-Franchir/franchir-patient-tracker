import { createServerClient } from '@/lib/supabase/server'
import { type Role } from '@/lib/permissions'
import NotificationBell from '@/components/notifications/notification-bell'
import AppHeader from '@/components/app-header'
import PatientList from '@/components/dashboard/patient-list'

const ITEMS_PER_PAGE = 20

async function getPatients(page: number = 0) {
  const supabase = await createServerClient()

  const { data: patients, count } = await supabase
    .from('patients')
    .select(`
      id,
      patient_name,
      created_at,
      workflow_statuses (label, color),
      profiles (full_name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE - 1)

  const formattedPatients = (patients || []).map((p: any) => ({
    id: p.id,
    patient_name: p.patient_name,
    created_at: p.created_at,
    workflow_statuses: Array.isArray(p.workflow_statuses) ? p.workflow_statuses[0] || null : p.workflow_statuses,
    profiles: Array.isArray(p.profiles) ? p.profiles[0] || null : p.profiles,
  }))

  return { patients: formattedPatients, total: count || 0 }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const supabase = await createServerClient()
  const params = await searchParams
  const currentPage = parseInt(params.page || '0')

  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user?.id)
    .single()

  const userRole = profile?.role as Role

  const { patients, total } = await getPatients(currentPage)
  const hasMore = (currentPage + 1) * ITEMS_PER_PAGE < total

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
              <p className="text-xs text-gray-500 mt-1">
                {total} patient{total > 1 ? 's' : ''} au total
              </p>
            </div>
            <div className="flex items-center gap-4">
              <NotificationBell />
            </div>
          </div>

          <PatientList
            initialPatients={patients}
            hasMore={hasMore}
            currentPage={currentPage}
          />
        </div>
      </div>
    </>
  )
}
