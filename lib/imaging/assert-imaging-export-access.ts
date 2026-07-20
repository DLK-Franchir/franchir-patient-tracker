import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { assertStaffProfile, type StaffRole } from '@/lib/access-control'
import { denyIfOutOfRoleScope } from '@/lib/patient-role-scope-guard'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type ImagingExportActor = {
  userId: string
  role: StaffRole
  fullName: string | null
  supabase: Awaited<ReturnType<typeof createServerClient>>
}

/**
 * Auth export DICOM : staff actif + scope rôle (même barrière que listing documents).
 */
export async function assertImagingExportAccess(
  patientId: string,
): Promise<ImagingExportActor | NextResponse> {
  if (!UUID_RE.test(patientId)) {
    return NextResponse.json({ error: 'Identifiant patient invalide' }, { status: 400 })
  }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, email, full_name')
    .eq('id', user.id)
    .single()

  if (!assertStaffProfile(profile)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const scopeDeny = await denyIfOutOfRoleScope(supabase, patientId, profile.role)
  if (scopeDeny) return scopeDeny

  return {
    userId: user.id,
    role: profile.role,
    fullName: profile.full_name ?? null,
    supabase,
  }
}
