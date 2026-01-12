import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: patientId } = await params
  const { message } = await req.json()

  if (!message || !message.trim()) {
    return NextResponse.json({ error: 'Message vide' }, { status: 400 })
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
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const { error: insertError } = await supabase
    .from('patient_messages')
    .insert({
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

  const { data: allProfiles } = await supabase
    .from('profiles')
    .select('id')
    .neq('id', user.id)

  if (allProfiles && allProfiles.length > 0) {
    const notifications = allProfiles.map(p => ({
      user_id: p.id,
      type: 'message',
      title: 'Nouveau message',
      message: `${profile.full_name} a écrit un message`,
      link: `/dashboard/patient/${patientId}`,
      read: false
    }))

    await supabase.from('notifications').insert(notifications)
  }

  return NextResponse.json({ success: true })
}
