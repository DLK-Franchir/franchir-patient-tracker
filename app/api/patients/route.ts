import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { apiError, createRouteHandler } from '@/lib/api/route-handler'
import { canCreatePatientResult } from '@/lib/access-control'
import { sendNewPatientNotifications } from '@/lib/notifications'
import { PatientCreateSchema } from '@/lib/validations'
import { revalidatePath } from 'next/cache'

export const POST = createRouteHandler('api/patients', async (req: Request) => {
  const payloadResult = PatientCreateSchema.safeParse(await req.json())
  if (!payloadResult.success) {
    apiError(400, payloadResult.error.issues[0]?.message ?? 'Payload invalide')
  }

  const { patient_name, clinical_summary, sharepoint_link } = payloadResult.data

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

  const createPermission = canCreatePatientResult(profile)
  if (!createPermission.allowed) {
    apiError(403, createPermission.reason ?? 'Forbidden')
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
    { id: user.id, full_name: profile.full_name, role: profile.role },
    { id: patient.id, patient_name }
  )

  revalidatePath('/dashboard')

  return NextResponse.json({ success: true, patientId: patient.id })
})