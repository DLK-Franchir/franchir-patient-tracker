import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { Logger } from '@/lib/logger'
import { sendNewMessageNotifications } from '@/lib/notifications'

const log = new Logger('api/patients/messages')

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: patientId } = await params
    const { message } = await req.json()

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Message vide' }, { status: 400 })
    }

    const supabase = await createServerClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [{ data: profile }, { data: patient }] = await Promise.all([
      supabase.from('profiles').select('role, full_name').eq('id', user.id).single(),
      supabase.from('patients').select('patient_name').eq('id', patientId).single(),
    ])

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
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
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    const patientName = patient?.patient_name || 'un patient'

    await sendNewMessageNotifications(
      supabase,
      { id: user.id, full_name: profile.full_name },
      { id: patientId, patient_name: patientName },
      message.trim()
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    log.error('Erreur envoi message', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}