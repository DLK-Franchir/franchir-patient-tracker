import { createServerClient } from '@/lib/supabase/server'
import { isStaffProfile } from '@/lib/access-control'
import { type Role } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import AppHeader from '@/components/app-header'
import PatientList from '@/components/dashboard/patient-list'
import { reconcileQuestionnaireSentStatusesForPatients } from '@/lib/integrations/issue-questionnaire-link'
import {
  computeDashboardSummary,
  filterPatientsForRole,
  getActifsPatientIds,
  getDefaultDashboardTab,
  getFocusPatientIds,
  getPipelinePatientIds,
  getRoleScopedPatientIds,
  getTabPatientIds,
  getToConfirmPatientIds,
  intersectPatientIds,
  normalizeDashboardFocus,
  normalizeDashboardKpi,
  normalizeDashboardTab,
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

type SummaryQueryRow = {
  id: string
  quote_accepted: boolean | null
  date_accepted: boolean | null
  workflow_statuses: WorkflowStatusOption | WorkflowStatusOption[] | null
}

async function getAllPatientsForSummary(): Promise<SummaryPatientExtended[]> {
  const supabase = await createServerClient()
  const { data } = await supabase
    .from('patients')
    .select(
      'id, quote_accepted, date_accepted, workflow_statuses!current_status_id (id, code, label)',
    )

  return ((data || []) as SummaryQueryRow[]).map((patient) => ({
    id: patient.id,
    quote_accepted: patient.quote_accepted ?? false,
    date_accepted: patient.date_accepted ?? false,
    workflow_statuses: firstRelation(patient.workflow_statuses),
  }))
}

async function getPatients({
  page,
  query,
  sort,
  direction,
  filterPatientIds,
}: {
  page: number
  query: string
  sort: SortColumn
  direction: SortDirection
  filterPatientIds?: string[] | null
}) {
  const supabase = await createServerClient()

  const from = (page - 1) * ITEMS_PER_PAGE
  const to = from + ITEMS_PER_PAGE - 1

  const fullQuery = supabase
    .from('patients')
    .select(
      'id, patient_name, created_at, questionnaire_status, proposed_date, quote_amount, quote_accepted, date_accepted, assigned_surgeon:surgeons!assigned_surgeon_id (full_name), workflow_statuses!current_status_id (id, code, label, color), profiles!created_by (full_name)',
      { count: 'exact' },
    )

  const baseQuery = supabase
    .from('patients')
    .select(
      'id, patient_name, created_at, questionnaire_status, proposed_date, quote_amount, quote_accepted, date_accepted, workflow_statuses!current_status_id (id, code, label, color), profiles!created_by (full_name)',
      { count: 'exact' },
    )

  if (query) {
    fullQuery.ilike('patient_name', `%${query}%`)
    baseQuery.ilike('patient_name', `%${query}%`)
  }
  if (filterPatientIds !== null && filterPatientIds !== undefined) {
    if (filterPatientIds.length === 0) {
      return { patients: [], total: 0 }
    }
    fullQuery.in('id', filterPatientIds)
    baseQuery.in('id', filterPatientIds)
  }

  const fullResult = await fullQuery
    .order(sort, { ascending: direction === 'asc' })
    .range(from, to)

  const { data: rawPatients, count, error: queryError } = fullResult.error
    ? await baseQuery.order(sort, { ascending: direction === 'asc' }).range(from, to)
    : fullResult

  void queryError

  const formattedPatients = ((rawPatients || []) as PatientQueryRow[]).map((patient) => ({
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
  }))

  const reconciledIds = await reconcileQuestionnaireSentStatusesForPatients(formattedPatients)
  if (reconciledIds.length > 0) {
    for (const patient of formattedPatients) {
      if (reconciledIds.includes(patient.id)) {
        patient.questionnaire_status = null
      }
    }
  }

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
  const dashboardRole = userRole as 'marcel' | 'gilles' | 'franchir' | 'admin'
  const focus: DashboardFocus = normalizeDashboardFocus(params.focus)
  const summaryPatients = await getAllPatientsForSummary()
  const roleScopedPatients = filterPatientsForRole(summaryPatients, dashboardRole)
  const roleScopeIds = getRoleScopedPatientIds(summaryPatients, dashboardRole)
  const dashboardSummary = computeDashboardSummary(
    roleScopedPatients,
    dashboardRole,
    roleScopedPatients,
  )

  const hasExplicitListFilter = Boolean(
    params.focus || params.tab || params.kpi || params.status || params.q,
  )
  let activeTab = normalizeDashboardTab(params.tab)
  if (!hasExplicitListFilter && !activeTab) {
    activeTab = getDefaultDashboardTab(dashboardRole, dashboardSummary)
  }

  const activeKpi = normalizeDashboardKpi(params.kpi)
  const pipelineGlobalStatus = selectedGlobalStatusFromCodes(selectedStatuses)

  let filterPatientIds: string[] | null = null
  if (focus !== 'all') {
    filterPatientIds = getFocusPatientIds(roleScopedPatients, dashboardRole, focus)
  } else if (activeKpi === 'toConfirm') {
    filterPatientIds = getToConfirmPatientIds(roleScopedPatients)
  } else if (activeKpi === 'actifs') {
    filterPatientIds = getActifsPatientIds(roleScopedPatients)
  } else if (activeTab) {
    filterPatientIds = getTabPatientIds(roleScopedPatients, activeTab)
  } else if (pipelineGlobalStatus) {
    filterPatientIds = getPipelinePatientIds(roleScopedPatients, pipelineGlobalStatus)
  }

  filterPatientIds = intersectPatientIds(filterPatientIds, roleScopeIds)

  const { patients, total } = await getPatients({
    page: currentPage,
    query: searchQuery,
    sort,
    direction,
    filterPatientIds,
  })
  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE))

  return (
    <>
      <AppHeader userRole={userRole} userName={profile?.full_name} showActions={true} />
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
