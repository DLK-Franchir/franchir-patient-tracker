import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { apiError, createRouteHandler, RouteContext } from '@/lib/api/route-handler'
import { canUseWorkflow } from '@/lib/access-control'
import { sendNewMessageNotifications } from '@/lib/notifications'

export const POST = createRouteHandler(
  'api/patients/messages',
  async (req: Request, { params }: RouteContext<{ id: string }>) => {
    const { id: patientId } = await params
    const { message } = await req.json()

    if (!message || !message.trim()) {
      apiError(400, 'Message vide')
    }

    const supabase = await createServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      apiError(401, 'Unauthorized')
    }

    const [{ data: profile }, { data: patient }] = await Promise.all([
      supabase.from('profiles').select('role, full_name, email').eq('id', user.id).single(),
      supabase.from('patients').select('patient_name').eq('id', patientId).single(),
    ])

    if (!profile) {
      apiError(404, 'Profile not found')
    }

    if (!canUseWorkflow(profile)) {
      apiError(403, 'Forbidden')
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

    const patientName = patient?.patient_name || 'un patient'

    await sendNewMessageNotifications(
      supabase,
      { id: user.id, full_name: profile.full_name },
      { id: patientId, patient_name: patientName },
      message.trim()
    )

    return NextResponse.json({ success: true })
  }
)
