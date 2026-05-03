import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { apiError, createRouteHandler } from '@/lib/api/route-handler'
import { canCreatePatient } from '@/lib/access-control'
import { sendNewPatientNotifications } from '@/lib/notifications'

export const POST = createRouteHandler('api/patients', async (req: Request) => {
  const { patient_name, clinical_summary, sharepoint_link } = await req.json()

  if (!patient_name || !sharepoint_link) {
    apiError(400, 'Champs requis manquants')
  }

  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    apiError(401, 'Unauthorized')
  }

  const [{ data: profile }, { data: status }] = await Promise.all([
    supabase.from('profiles').select('role, full_name, email').eq('id', user.id).single(),
    supabase.from('workflow_statuses').select('id').eq('code', 'prospect_created').single(),
  ])

  if (!profile) {
    apiError(404, 'Profile not found')
  }

  if (!canCreatePatient(profile)) {
    apiError(403, 'Forbidden')
  }

  const { data: patient, error: insertError } = await supabase
    .from('patients')
    .insert({
      patient_name,
      clinical_summary,
      sharepoint_link,
      current_status_id: status?.id,
      created_by: user.id,
    })
    .select()
    .single()

  if (insertError) {
    apiError(500, insertError.message)
  }

  await sendNewPatientNotifications(
    supabase,
    { id: user.id, full_name: profile.full_name },
    { id: patient.id, patient_name }
  )

  return NextResponse.json({ success: true, patientId: patient.id })
})
