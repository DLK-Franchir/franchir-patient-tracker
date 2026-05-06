import { createServerClient } from '@/lib/supabase/server'

const ITEMS_PER_PAGE = 20

export const SORT_COLUMNS = ['created_at', 'patient_name', 'current_status_id'] as const
export const SORT_DIRECTIONS = ['asc', 'desc'] as const

export type SortColumn = (typeof SORT_COLUMNS)[number]
export type SortDirection = (typeof SORT_DIRECTIONS)[number]

export type WorkflowStatusOption = {
  id: string
  code: string
  label: string
  color: string
}

export type PatientRow = {
  id: string
  patient_name: string
  created_at: string
  proposed_date: string | null
  confirmed_surgery_date: string | null
  confirmed_surgeon_name: string | null
  workflow_statuses: WorkflowStatusOption | null
  profiles: { full_name: string } | null
}

export type PatientListResult = {
  patients: PatientRow[]
  total: number
}

export type PatientListParams = {
  page: number
  query: string
  statuses: string[]
  sort: SortColumn
  direction: SortDirection
  statusOptions: WorkflowStatusOption[]
}

type RawPatientQueryRow = {
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

export async function queryWorkflowStatuses(): Promise<WorkflowStatusOption[]> {
  const supabase = await createServerClient()
  const { data } = await supabase
    .from('workflow_statuses')
    .select('id, code, label, color')
    .order('order_position', { ascending: true })

  return (data || []) as WorkflowStatusOption[]
}

export async function queryPatients({
  page,
  query,
  statuses,
  sort,
  direction,
  statusOptions,
}: PatientListParams): Promise<PatientListResult> {
  const supabase = await createServerClient()

  const selectedStatusIds = statusOptions
    .filter(status => statuses.includes(status.code))
    .map(status => status.id)

  let patientQuery = supabase.from('patients').select(
    `
      id,
      patient_name,
      created_at,
      proposed_date,
      confirmed_surgery_date,
      confirmed_surgeon_name,
      workflow_statuses!current_status_id (id, code, label, color),
      profiles!created_by (full_name)
    `,
    { count: 'exact' }
  )

  if (query) {
    patientQuery = patientQuery.ilike('patient_name', `%${query}%`)
  }

  if (selectedStatusIds.length > 0) {
    patientQuery = patientQuery.in('current_status_id', selectedStatusIds)
  }

  const from = (page - 1) * ITEMS_PER_PAGE
  const to = from + ITEMS_PER_PAGE - 1

  const { data: patients, count } = await patientQuery
    .order(sort, { ascending: direction === 'asc' })
    .range(from, to)

  const formattedPatients = ((patients || []) as RawPatientQueryRow[]).map(patient => ({
    id: patient.id,
    patient_name: patient.patient_name,
    created_at: patient.created_at,
    proposed_date: patient.proposed_date,
    confirmed_surgery_date: patient.confirmed_surgery_date,
    confirmed_surgeon_name: patient.confirmed_surgeon_name,
    workflow_statuses: firstRelation(patient.workflow_statuses),
    profiles: firstRelation(patient.profiles),
  }))

  return { patients: formattedPatients, total: count || 0 }
}

export type PatientDetailRow = {
  id: string
  patient_name: string
  clinical_summary: string | null
  sharepoint_link: string | null
  current_status_id: string | null
  created_by: string
  created_at: string
  updated_at: string
  quote_accepted: boolean
  date_accepted: boolean
  proposed_date: string | null
  confirmed_surgery_date: string | null
  confirmed_surgeon_name: string | null
  workflow_statuses: WorkflowStatusOption | null
  profiles: { full_name: string; role: string } | null
}

export async function queryPatientDetail(patientId: string): Promise<PatientDetailRow | null> {
  const supabase = await createServerClient()

  type RawDetail = Omit<PatientDetailRow, 'workflow_statuses' | 'profiles'> & {
    workflow_statuses: WorkflowStatusOption | WorkflowStatusOption[] | null
    profiles: { full_name: string; role: string } | { full_name: string; role: string }[] | null
  }

  const { data, error } = await supabase
    .from('patients')
    .select(
      `
        id,
        patient_name,
        clinical_summary,
        sharepoint_link,
        current_status_id,
        created_by,
        created_at,
        updated_at,
        quote_accepted,
        date_accepted,
        proposed_date,
        confirmed_surgery_date,
        confirmed_surgeon_name,
        workflow_statuses!current_status_id (id, code, label, color),
        profiles!created_by (full_name, role)
      `
    )
    .eq('id', patientId)
    .single()

  if (error || !data) return null

  const raw = data as unknown as RawDetail

  return {
    ...raw,
    workflow_statuses: firstRelation(raw.workflow_statuses),
    profiles: firstRelation(raw.profiles),
  }
}

export type AdminPatientRow = {
  id: string
  patient_name: string
  created_at: string
  updated_at: string
  proposed_date: string | null
  confirmed_surgery_date: string | null
  confirmed_surgeon_name: string | null
  workflow_statuses: WorkflowStatusOption | null
  profiles: { full_name: string; role: string } | null
}

export type AdminPatientListParams = {
  page: number
  query: string
  statuses: string[]
  sort: SortColumn
  direction: SortDirection
  statusOptions: WorkflowStatusOption[]
}

export async function queryAdminPatients({
  page,
  query,
  statuses,
  sort,
  direction,
  statusOptions,
}: AdminPatientListParams): Promise<{ patients: AdminPatientRow[]; total: number }> {
  const supabase = await createServerClient()

  const selectedStatusIds = statusOptions
    .filter(s => statuses.includes(s.code))
    .map(s => s.id)

  let q = supabase.from('patients').select(
    `
      id,
      patient_name,
      created_at,
      updated_at,
      proposed_date,
      confirmed_surgery_date,
      confirmed_surgeon_name,
      workflow_statuses!current_status_id (id, code, label, color),
      profiles!created_by (full_name, role)
    `,
    { count: 'exact' }
  )

  if (query) {
    q = q.ilike('patient_name', `%${query}%`)
  }

  if (selectedStatusIds.length > 0) {
    q = q.in('current_status_id', selectedStatusIds)
  }

  const from = (page - 1) * ITEMS_PER_PAGE
  const to = from + ITEMS_PER_PAGE - 1

  const { data, count } = await q.order(sort, { ascending: direction === 'asc' }).range(from, to)

  type RawAdmin = Omit<AdminPatientRow, 'workflow_statuses' | 'profiles'> & {
    workflow_statuses: WorkflowStatusOption | WorkflowStatusOption[] | null
    profiles:
      | { full_name: string; role: string }
      | { full_name: string; role: string }[]
      | null
  }

  const patients = ((data || []) as RawAdmin[]).map(row => ({
    ...row,
    workflow_statuses: firstRelation(row.workflow_statuses),
    profiles: firstRelation(row.profiles),
  }))

  return { patients, total: count || 0 }
}