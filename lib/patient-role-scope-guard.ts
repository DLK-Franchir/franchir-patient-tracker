import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  canManagePatientDocuments,
  isGillesErikVisibilityScope,
  type ProfileAccess,
  type StaffRole,
} from '@/lib/access-control'
import { isRoleScopedPatient, type SummaryPatient } from '@/lib/dashboard-summary'

const ROLE_SCOPE_DENY_MESSAGE = 'Accès refusé à ce dossier'

type WorkflowStatusRow = SummaryPatient['workflow_statuses']

export type PatientAccessRow = {
  id: string
  visibility_scope?: string | null
  workflow_statuses?: WorkflowStatusRow | WorkflowStatusRow[] | null
}

function firstWorkflowStatus(
  value: WorkflowStatusRow | WorkflowStatusRow[] | null | undefined,
): WorkflowStatusRow {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

/** Vérifie le périmètre Gilles quand le statut workflow est déjà chargé. */
export function denyRoleScopeForPatient(
  role: StaffRole,
  patient: PatientAccessRow,
): NextResponse | null {
  if (isGillesErikVisibilityScope(patient.visibility_scope)) {
    return null
  }

  if (role !== 'gilles') return null

  const workflowStatus = firstWorkflowStatus(patient.workflow_statuses)
  if (!isRoleScopedPatient({ id: patient.id, workflow_statuses: workflowStatus }, role)) {
    return NextResponse.json({ error: ROLE_SCOPE_DENY_MESSAGE }, { status: 403 })
  }

  return null
}

export async function requireAccessiblePatient(
  supabase: SupabaseClient,
  patientId: string,
  role: StaffRole,
): Promise<{ ok: true; patient: PatientAccessRow } | { ok: false; response: NextResponse }> {
  const { data, error } = await supabase
    .from('patients')
    .select('id, visibility_scope, workflow_statuses:workflow_statuses!current_status_id (id, code, label)')
    .eq('id', patientId)
    .maybeSingle()

  if (error) {
    return { ok: false, response: NextResponse.json({ error: error.message }, { status: 500 }) }
  }

  if (!data) {
    return { ok: false, response: NextResponse.json({ error: 'Patient non trouvé' }, { status: 404 }) }
  }

  const deny = denyRoleScopeForPatient(role, data)
  if (deny) {
    return { ok: false, response: deny }
  }

  return { ok: true, patient: data }
}

export async function requireDocumentWriteAccess(
  supabase: SupabaseClient,
  patientId: string,
  profile: ProfileAccess | null,
): Promise<{ ok: true; patient: PatientAccessRow } | { ok: false; response: NextResponse }> {
  if (!profile?.role) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  const access = await requireAccessiblePatient(supabase, patientId, profile.role as StaffRole)
  if (!access.ok) return access

  if (!canManagePatientDocuments(profile, access.patient)) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return access
}

/** Charge le statut workflow et refuse l'accès si le dossier est hors périmètre rôle. */
export async function denyIfOutOfRoleScope(
  supabase: SupabaseClient,
  patientId: string,
  role: StaffRole,
): Promise<NextResponse | null> {
  const access = await requireAccessiblePatient(supabase, patientId, role)
  return access.ok ? null : access.response
}
