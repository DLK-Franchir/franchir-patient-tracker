import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { apiError, createRouteHandler, RouteContext } from '@/lib/api/route-handler'
import { canPostPatientMessageResult } from '@/lib/access-control'
import { sendNewMessageNotifications } from '@/lib/notifications'
import { globalStatusFromWorkflowStatus } from '@/lib/workflow-v2'
import { MessageSchema } from '@/lib/validations'

export const POST = createRouteHandler(
  'api/patients/messages',
  async (req: Request, { params }: RouteContext<{ id: string }>) => {
    const { id: patientId } = await params
    const payloadResult = MessageSchema.safeParse(await req.json())
    if (!payloadResult.success) {
      apiError(400, payloadResult.error.issues[0]?.message ?? 'Payload invalide')
    }

    const { message } = payloadResult.data

    const supabase = await createServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      apiError(401, 'Unauthorized')
    }

    const [{ data: profile }, { data: patient }] = await Promise.all([
      supabase.from('profiles').select('role, full_name, email').eq('id', user.id).single(),
      supabase
        .from('patients')
        .select(
          'patient_name, current_status:workflow_statuses!current_status_id (id, code, label)'
        )
        .eq('id', patientId)
        .single(),
    ])

    if (!profile) {
      apiError(404, 'Profile not found')
    }

    if (!patient) {
      apiError(404, 'Patient not found')
    }

    const currentStatus = Array.isArray(patient.current_status)
      ? patient.current_status[0]
      : patient.current_status
    const globalStatus = globalStatusFromWorkflowStatus(currentStatus)

    const postPermission = canPostPatientMessageResult(profile, globalStatus)
    if (!postPermission.allowed) {
      apiError(403, postPermission.reason ?? 'Forbidden')
    }

    const { error: insertError } = await supabase.from('patient_messages').insert({
      patient_id: patientId,
      author_id: user.id,
      author_name: profile.full_name,
      author_role: profile.role,
      kind: 'message',
      title: null,
      body: message.trim(),
      meta: {},
    })

    if (insertError) {
      apiError(500, insertError.message)
    }

    const patientName = patient.patient_name || 'un patient'

    await sendNewMessageNotifications(
      supabase,
      { id: user.id, full_name: profile.full_name, role: profile.role },
      { id: patientId, patient_name: patientName }
    )

    return NextResponse.json({ success: true })
  }
)
