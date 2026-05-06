import { createServerClient } from '@/lib/supabase/server'
import { isStaffProfile } from '@/lib/access-control'
import { type Role } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import NotificationBell from '@/components/notifications/notification-bell'
import AppHeader from '@/components/app-header'
import PatientList from '@/components/dashboard/patient-list'

const ITEMS_PER_PAGE = 20
const SORT_COLUMNS = ['created_at', 'patient_name', 'current_status_id'] as const
const SORT_DIRECTIONS = ['asc', 'desc'] as const

type SortColumn = (typeof SORT_COLUMNS)[number]
type SortDirection = (typeof SORT_DIRECTIONS)[number]

type DashboardSearchParams = {
  page?: string
  q?: string
  status?: string | string[]
  sort?: string
  dir?: string
}

type WorkflowStatusOption = {
  id: string
  code: string
  label: string
  color: string
}

type PatientQueryRow = {
  id: string
  patient_name: string
  created_at: string
  proposed_date: string | null
  confirmed_surgery_date: string | null
  confirmed_surgeon_name: string | null
  workflow_statuses: WorkflowStatusOption | WorkflowStatusOption[] | null
  profiles: { full_name: string } | { full_name: string }[] | null
}

function firstRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] || null : value
}

function normalizeStatuses(status: string | string[] | undefined): string[] {
  const values = Array.isArray(status) ? status : status ? [status] : []
  return values
    .flatMap(value => value.split(','))
    .map(value => value.trim())
    .filter(Boolean)
}

function normalizePage(page: string | undefined): number {
  const value = Number.parseInt(page || '1', 10)
  return Number.isFinite(value) && value > 0 ? value : 1
}

function normalizeSort(sort: string | undefined): SortColumn {
  return SORT_COLUMNS.includes(sort as SortColumn) ? (sort as SortColumn) : 'created_at'
}

function normalizeDirection(direction: string | undefined): SortDirection {
  return SORT_DIRECTIONS.includes(direction as SortDirection)
    ? (direction as SortDirection)
    : 'desc'
}

async function getWorkflowStatuses(): Promise<WorkflowStatusOption[]> {
  const supabase = await createServerClient()
  const { data } = await supabase
    .from('workflow_statuses')
    .select('id, code, label, color')
    .order('order_position', { ascending: true })

  return (data || []) as WorkflowStatusOption[]
}

async function getPatients({
  page,
  query,
  statuses,
  sort,
  direction,
  statusOptions,
}: {
  page: number
  query: string
  statuses: string[]
  sort: SortColumn
  direction: SortDirection
  statusOptions: WorkflowStatusOption[]
}) {
  const supabase = await createServerClient()
  const selectedStatusIds = statusOptions
    .filter(status => statuses.includes(status.code))
    .map(status => status.id)

  const from = (page - 1) * ITEMS_PER_PAGE
  const to = from + ITEMS_PER_PAGE - 1

  const fullQuery = supabase
    .from('patients')
    .select(
      'id, patient_name, created_at, proposed_date, confirmed_surgery_date, confirmed_surgeon_name, workflow_statuses!current_status_id (id, code, label, color), profiles!created_by (full_name)',
      { count: 'exact' }
    )

  const baseQuery = supabase
    .from('patients')
    .select(
      'id, patient_name, created_at, proposed_date, workflow_statuses!current_status_id (id, code, label, color), profiles!created_by (full_name)',
      { count: 'exact' }
    )

  if (query) {
    fullQuery.ilike('patient_name', `%${query}%`)
    baseQuery.ilike('patient_name', `%${query}%`)
  }
  if (selectedStatusIds.length > 0) {
    fullQuery.in('current_status_id', selectedStatusIds)
    baseQuery.in('current_status_id', selectedStatusIds)
  }

  const fullResult = await fullQuery
    .order(sort, { ascending: direction === 'asc' })
    .range(from, to)

  const { data: rawPatients, count, error: queryError } = fullResult.error
    ? await baseQuery.order(sort, { ascending: direction === 'asc' }).range(from, to)
    : fullResult

  void queryError

  const formattedPatients = ((rawPatients || []) as PatientQueryRow[]).map(patient => ({
    id: patient.id,
    patient_name: patient.patient_name,
    created_at: patient.created_at,
    proposed_date: patient.proposed_date,
    confirmed_surgery_date: patient.confirmed_surgery_date ?? null,
    confirmed_surgeon_name: patient.confirmed_surgeon_name ?? null,
    workflow_statuses: firstRelation(patient.workflow_statuses),
    profiles: firstRelation(patient.profiles),
  }))

  return { patients: formattedPatients, total: count || 0 }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<DashboardSearchParams>
}) {
  const supabase = await createServerClient()
  const params = await searchParams
  const currentPage = normalizePage(params.page)
  const searchQuery = (params.q || '').trim()
  const selectedStatuses = normalizeStatuses(params.status)
  const sort = normalizeSort(params.sort)
  const direction = normalizeDirection(params.dir)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  if (!isStaffProfile(profile)) {
    redirect('/login?error=unauthorized')
  }

  const userRole = profile?.role as Role
  const statusOptions = await getWorkflowStatuses()
  const { patients, total } = await getPatients({
    page: currentPage,
    query: searchQuery,
    statuses: selectedStatuses,
    sort,
    direction,
    statusOptions,
  })
  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE))

  return (
    <>
      <AppHeader userRole={userRole} userName={profile?.full_name} showActions={true} />
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <nav className="mb-2 text-sm text-gray-500" aria-label="Fil d'Ariane">
                <span className="font-medium text-gray-700">Tableau de bord</span>
              </nav>
              <h1 className="text-2xl font-extrabold text-gray-900 sm:text-3xl">
                Tableau de Suivi FRANCHIR
              </h1>
              <p className="mt-1 text-xs text-gray-600 sm:text-sm">
                Connecté : {profile?.full_name} - <span className="font-semibold">{userRole}</span>
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {total} patient{total > 1 ? 's' : ''} trouvé{total > 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <NotificationBell />
            </div>
          </div>

          <PatientList
            initialPatients={patients}
            total={total}
            totalPages={totalPages}
            currentPage={currentPage}
            itemsPerPage={ITEMS_PER_PAGE}
            searchQuery={searchQuery}
            selectedStatuses={selectedStatuses}
            statusOptions={statusOptions}
            sort={sort}
            direction={direction}
            userRole={userRole as 'marcel' | 'gilles' | 'franchir' | 'admin'}
          />
        </div>
      </div>
    </>
  )
}
