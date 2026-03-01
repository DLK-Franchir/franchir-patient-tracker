import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { EMAIL_FROM, getEmailForProfile } from '@/lib/email-config'

const resend = new Resend(process.env.RESEND_API_KEY)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.franchir.eu'

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

  const { data: patient } = await supabase
    .from('patients')
    .select('patient_name')
    .eq('id', patientId)
    .single()

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
    .select('id, role, email, full_name')
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

    const patientLink = `${APP_URL}/dashboard/patient/${patientId}`
    const patientName = patient?.patient_name || 'un patient'

    const emailPromises = allProfiles
      .map(p => ({ ...p, realEmail: getEmailForProfile(p) }))
      .filter(p => p.realEmail)
      .map(p =>
        resend.emails.send({
          from: EMAIL_FROM,
          to: p.realEmail!,
          subject: `Nouveau message de ${profile.full_name} — ${patientName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2563EB;">Nouveau message sur le dossier</h2>
              <p>Bonjour ${p.full_name},</p>
              <p><strong>${profile.full_name}</strong> a posté un nouveau message concernant le dossier de <strong>${patientName}</strong> :</p>
              <blockquote style="border-left: 4px solid #2563EB; padding-left: 16px; margin: 16px 0; color: #374151;">
                ${message.trim().replace(/\n/g, '<br>')}
              </blockquote>
              <a href="${patientLink}" style="display: inline-block; background-color: #2563EB; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 8px;">
                Voir le dossier
              </a>
              <p style="color: #6B7280; font-size: 12px; margin-top: 24px;">FRANCHIR — Suivi des dossiers patients</p>
            </div>
          `,
        })
      )

    await Promise.allSettled(emailPromises)
  }

  return NextResponse.json({ success: true })
}