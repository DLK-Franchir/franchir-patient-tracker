import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { StaffRole } from '@/lib/access-control'
import { isRoleScopedPatient, type SummaryPatient } from '@/lib/dashboard-summary'

const ROLE_SCOPE_DENY_MESSAGE = 'Accès refusé à ce dossier'

type WorkflowStatusRow = SummaryPatient['workflow_statuses']

function firstWorkflowStatus(
  value: WorkflowStatusRow | WorkflowStatusRow[] | null | undefined,
): WorkflowStatusRow {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

/** Vérifie le périmètre Gilles quand le statut workflow est déjà chargé. */
export function denyRoleScopeForPatient(
  role: StaffRole,
  patient: { id: string; workflow_statuses?: WorkflowStatusRow | WorkflowStatusRow[] | null },
): NextResponse | null {
  if (role !== 'gilles') return null

  const workflowStatus = firstWorkflowStatus(patient.workflow_statuses)
  if (!isRoleScopedPatient({ id: patient.id, workflow_statuses: workflowStatus }, role)) {
    return NextResponse.json({ error: ROLE_SCOPE_DENY_MESSAGE }, { status: 403 })
  }

  return null
}

/** Charge le statut workflow et refuse l'accès si le dossier est hors périmètre rôle. */
export async function denyIfOutOfRoleScope(
  supabase: SupabaseClient,
  patientId: string,
  role: StaffRole,
): Promise<NextResponse | null> {
  if (role !== 'gilles') return null

  const { data, error } = await supabase
    .from('patients')
    .select('id, workflow_statuses:workflow_statuses!current_status_id (id, code, label)')
    .eq('id', patientId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Patient non trouvé' }, { status: 404 })
  }

  return denyRoleScopeForPatient(role, data)
}
