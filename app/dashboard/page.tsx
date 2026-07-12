import { createServerClient } from '@/lib/supabase/server'
import { isStaffProfile } from '@/lib/access-control'
import { type Role } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import AppHeader from '@/components/app-header'
import PatientList from '@/components/dashboard/patient-list'
import { reconcileQuestionnaireSentStatusesForPatients } from '@/lib/integrations/issue-questionnaire-link'
import {
  computeDashboardSummary,
  filterPatientsForRole,
  getActifsPatientIds,
  getFocusPatientIds,
  getPipelinePatientIds,
  getRoleScopedPatientIds,
  getTabPatientIds,
  getToConfirmPatientIds,
  hadRoleInvalidatedListFilter,
  intersectPatientIds,
  normalizeDashboardFocus,
  normalizeDashboardKpi,
  normalizeDashboardKpiForRole,
  normalizeDashboardTab,
  normalizeDashboardTabForRole,
  selectedGlobalStatusFromCodes,
  type DashboardFocus,
  type SummaryPatientExtended,
} from '@/lib/dashboard-summary'

const ITEMS_PER_PAGE = 20
const SORT_COLUMNS = ['created_at', 'patient_name', 'current_status_id'] as const
const SORT_DIRECTIONS = ['asc', 'desc'] as const

type SortColumn = (typeof SORT_COLUMNS)[number]
type SortDirection = (typeof SORT_DIRECTIONS)[number]

type DashboardSearchParams = {
  page?: string
  q?: string
  status?: string | string[]
  focus?: string
  tab?: string
  kpi?: string
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
  questionnaire_status: string | null
  proposed_date: string | null
  quote_amount: number | null
  quote_accepted: boolean | null
  date_accepted: boolean | null
  assigned_surgeon: { full_name: string } | { full_name: string }[] | null
  workflow_statuses: WorkflowStatusOption | WorkflowStatusOption[] | null
  profiles: { full_name: string } | { full_name: string }[] | null
}

type DashboardPatient = {
  id: string
  patient_name: string
  created_at: string
  questionnaire_status: string | null
  proposed_date: string | null
  quote_amount: number | null
  quote_accepted: boolean
  date_accepted: boolean
  assigned_surgeon_name: string | null
  workflow_statuses: WorkflowStatusOption | null
  profiles: { full_name: string } | null
}

function firstRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] || null : value
}

function normalizeStatuses(status: string | string[] | undefined): string[] {
  const values = Array.isArray(status) ? status : status ? [status] : []
  return values
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
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

function formatDashboardPatient(patient: PatientQueryRow): DashboardPatient {
  return {
    id: patient.id,
    patient_name: patient.patient_name,
    created_at: patient.created_at,
    questionnaire_status: patient.questionnaire_status ?? null,
    proposed_date: patient.proposed_date,
    quote_amount: patient.quote_amount ?? null,
    quote_accepted: patient.quote_accepted ?? false,
    date_accepted: patient.date_accepted ?? false,
    assigned_surgeon_name: firstRelation(patient.assigned_surgeon)?.full_name ?? null,
    workflow_statuses: firstRelation(patient.workflow_statuses),
    profiles: firstRelation(patient.profiles),
  }
}

function toSummaryPatient(patient: DashboardPatient): SummaryPatientExtended {
  return {
    id: patient.id,
    quote_accepted: patient.quote_accepted,
    date_accepted: patient.date_accepted,
    workflow_statuses: patient.workflow_statuses,
  }
}

async function fetchAllDashboardPatients(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
): Promise<DashboardPatient[]> {
  const fullSelect =
    'id, patient_name, created_at, questionnaire_status, proposed_date, quote_amount, quote_accepted, date_accepted, assigned_surgeon:surgeons!assigned_surgeon_id (full_name), workflow_statuses!current_status_id (id, code, label, color), profiles!created_by (full_name)'
  const baseSelect =
    'id, patient_name, created_at, questionnaire_status, proposed_date, quote_amount, quote_accepted, date_accepted, workflow_statuses!current_status_id (id, code, label, color), profiles!created_by (full_name)'

  const fullResult = await supabase.from('patients').select(fullSelect)
  const { data: rawPatients } = fullResult.error
    ? await supabase.from('patients').select(baseSelect)
    : fullResult

  return ((rawPatients || []) as PatientQueryRow[]).map(formatDashboardPatient)
}

function sortDashboardPatients(
  patients: DashboardPatient[],
  sort: SortColumn,
  direction: SortDirection,
): DashboardPatient[] {
  const multiplier = direction === 'asc' ? 1 : -1

  return [...patients].sort((left, right) => {
    let comparison = 0

    if (sort === 'patient_name') {
      comparison = left.patient_name.localeCompare(right.patient_name, 'fr')
    } else if (sort === 'current_status_id') {
      const leftId = left.workflow_statuses?.id ?? ''
      const rightId = right.workflow_statuses?.id ?? ''
      comparison = leftId.localeCompare(rightId)
    } else {
      comparison = left.created_at.localeCompare(right.created_at)
    }

    return comparison * multiplier
  })
}

function paginateDashboardPatients({
  patients,
  page,
  query,
  sort,
  direction,
  filterPatientIds,
}: {
  patients: DashboardPatient[]
  page: number
  query: string
  sort: SortColumn
  direction: SortDirection
  filterPatientIds?: string[] | null
}): { patients: DashboardPatient[]; total: number } {
  let filtered = patients

  if (filterPatientIds !== null && filterPatientIds !== undefined) {
    if (filterPatientIds.length === 0) {
      return { patients: [], total: 0 }
    }
    const allowedIds = new Set(filterPatientIds)
    filtered = filtered.filter((patient) => allowedIds.has(patient.id))
  }

  if (query) {
    const normalizedQuery = query.toLowerCase()
    filtered = filtered.filter((patient) =>
      patient.patient_name.toLowerCase().includes(normalizedQuery),
    )
  }

  const sorted = sortDashboardPatients(filtered, sort, direction)
  const total = sorted.length
  const from = (page - 1) * ITEMS_PER_PAGE

  return {
    patients: sorted.slice(from, from + ITEMS_PER_PAGE),
    total,
  }
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

  const [{ data: profile }, allPatients] = await Promise.all([
    supabase.from('profiles').select('role, full_name, email').eq('id', user.id).single(),
    fetchAllDashboardPatients(supabase),
  ])

  if (!isStaffProfile(profile)) {
    redirect('/login?error=unauthorized')
  }

  const userRole = profile?.role as Role
  const dashboardRole = userRole as 'marcel' | 'gilles' | 'franchir' | 'admin'
  const focus: DashboardFocus = normalizeDashboardFocus(params.focus)
  const summaryPatients = allPatients.map(toSummaryPatient)
  const roleScopedPatients = filterPatientsForRole(summaryPatients, dashboardRole)
  const roleScopeIds = getRoleScopedPatientIds(summaryPatients, dashboardRole)
  const dashboardSummary = computeDashboardSummary(
    roleScopedPatients,
    dashboardRole,
    roleScopedPatients,
  )

  const activeTab = normalizeDashboardTabForRole(
    normalizeDashboardTab(params.tab),
    dashboardRole,
  )
  const activeKpi = normalizeDashboardKpiForRole(
    normalizeDashboardKpi(params.kpi),
    dashboardRole,
  )

  const pipelineGlobalStatus = selectedGlobalStatusFromCodes(selectedStatuses)

  let filterPatientIds: string[] | null = null
  if (focus !== 'all') {
    filterPatientIds = getFocusPatientIds(roleScopedPatients, dashboardRole, focus)
  } else if (activeKpi === 'toConfirm') {
    filterPatientIds = getToConfirmPatientIds(roleScopedPatients)
  } else if (activeKpi === 'suiviCommercial') {
    filterPatientIds = getTabPatientIds(roleScopedPatients, 'commercial')
  } else if (activeKpi === 'actifs') {
    filterPatientIds = getActifsPatientIds(roleScopedPatients)
  } else if (activeTab) {
    filterPatientIds = getTabPatientIds(roleScopedPatients, activeTab)
  } else if (pipelineGlobalStatus) {
    filterPatientIds = getPipelinePatientIds(roleScopedPatients, pipelineGlobalStatus)
  }

  filterPatientIds = intersectPatientIds(filterPatientIds, roleScopeIds)

  if (
    filterPatientIds?.length === 0 &&
    roleScopeIds &&
    roleScopeIds.length > 0 &&
    hadRoleInvalidatedListFilter(params, dashboardRole)
  ) {
    filterPatientIds = roleScopeIds
  }

  const { patients, total } = paginateDashboardPatients({
    patients: allPatients,
    page: currentPage,
    query: searchQuery,
    sort,
    direction,
    filterPatientIds,
  })
  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE))

  if (patients.some((patient) => patient.questionnaire_status === 'sent')) {
    after(() => reconcileQuestionnaireSentStatusesForPatients(patients))
  }

  return (
    <>
      <AppHeader userRole={userRole} showActions={true} />
      <div className="min-h-screen bg-franchir-cream p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-[1400px]">
          <PatientList
            initialPatients={patients}
            total={total}
            totalPages={totalPages}
            currentPage={currentPage}
            itemsPerPage={ITEMS_PER_PAGE}
            searchQuery={searchQuery}
            selectedStatuses={selectedStatuses}
            activeTab={activeTab}
            activeKpi={activeKpi}
            sort={sort}
            direction={direction}
            userRole={dashboardRole}
            userDisplayName={profile?.full_name ?? undefined}
            dashboardSummary={dashboardSummary}
            focus={focus}
            totalPatients={roleScopedPatients.length}
          />
        </div>
      </div>
    </>
  )
}
