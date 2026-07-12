import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { StaffRole } from '@/lib/access-control'
import { CASE_CLOSED_STATUS_CODE } from '@/lib/workflow-v2'

const ARCHIVED_WRITE_ERROR = 'Dossier fermé — modification interdite.'

export async function isPatientDossierClosed(
  supabase: SupabaseClient,
  patientId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('patients')
    .select('current_status:workflow_statuses!current_status_id (code)')
    .eq('id', patientId)
    .maybeSingle()

  const status = Array.isArray(data?.current_status)
    ? data.current_status[0]
    : data?.current_status

  return status?.code === CASE_CLOSED_STATUS_CODE
}

/** Non-admin : aucune mutation directe sur un dossier archivé (workflow reopen sauf). */
export function isArchivedPatientWriteBlocked(isClosed: boolean, role?: StaffRole | null): boolean {
  return isClosed && role !== 'admin'
}

export async function denyIfArchivedPatientWrite(
  supabase: SupabaseClient,
  patientId: string,
  role?: StaffRole | null,
): Promise<NextResponse | null> {
  if (!isArchivedPatientWriteBlocked(await isPatientDossierClosed(supabase, patientId), role)) {
    return null
  }
  return NextResponse.json({ error: ARCHIVED_WRITE_ERROR }, { status: 403 })
}
