import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { EMAIL_FROM, getEmailForProfile } from '@/lib/email-config'

const resend = new Resend(process.env.RESEND_API_KEY)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.franchir.eu'

export async function POST(req: Request) {
  try {
    const { patient_name, clinical_summary, sharepoint_link } = await req.json()

    if (!patient_name || !sharepoint_link) {
      return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 })
    }

    const supabase = await createServerClient()

    const { data: { user } } = await supabase.auth.getUser()
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

    const { data: status } = await supabase
      .from('workflow_statuses')
      .select('id')
      .eq('code', 'prospect_created')
      .single()

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
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    const { data: otherProfiles } = await supabase
      .from('profiles')
      .select('id, role, email, full_name')
      .neq('id', user.id)

    if (otherProfiles && otherProfiles.length > 0) {
      const notifications = otherProfiles.map(p => ({
        user_id: p.id,
        patient_id: patient.id,
        type: 'info',
        title: 'Nouveau dossier créé',
        message: `${profile.full_name} a créé le dossier de ${patient_name}.`,
      }))
      await supabase.from('notifications').insert(notifications)

      const patientLink = `${APP_URL}/dashboard/patient/${patient.id}`

      const emailPromises = otherProfiles
        .map(p => ({ ...p, realEmail: getEmailForProfile(p) }))
        .filter(p => p.realEmail)
        .map(p =>
          resend.emails.send({
            from: EMAIL_FROM,
            to: p.realEmail!,
            subject: `Nouveau dossier créé — ${patient_name}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563EB;">Nouveau dossier patient</h2>
                <p>Bonjour ${p.full_name},</p>
                <p><strong>${profile.full_name}</strong> vient de créer le dossier de <strong>${patient_name}</strong>.</p>
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

    return NextResponse.json({ success: true, patientId: patient.id })
  } catch (error) {
    console.error('❌ Erreur création patient:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
