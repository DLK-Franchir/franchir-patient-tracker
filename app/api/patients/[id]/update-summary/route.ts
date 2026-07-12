import { createServerClient } from '@/lib/supabase/server'
import { canEditPatientSummary, type StaffRole } from '@/lib/access-control'
import { denyIfArchivedPatientWrite } from '@/lib/patient-archive-guard'
import { NextResponse } from 'next/server'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: patientId } = await params
  const { clinical_summary, sharepoint_link } = await req.json()

  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, email')
    .eq('id', user.id)
    .single()

  if (!canEditPatientSummary(profile)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const archivedDeny = await denyIfArchivedPatientWrite(
    supabase,
    patientId,
    profile.role as StaffRole,
  )
  if (archivedDeny) return archivedDeny

  const { error } = await supabase
    .from('patients')
    .update({
      clinical_summary,
      sharepoint_link,
    })
    .eq('id', patientId)

  if (error) {
    console.error('Erreur mise à jour patient:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}