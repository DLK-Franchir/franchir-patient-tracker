import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { Logger } from '@/lib/logger'
import { sendNewPatientNotifications } from '@/lib/notifications'

const log = new Logger('api/patients')

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

    const [{ data: profile }, { data: status }] = await Promise.all([
      supabase.from('profiles').select('role, full_name').eq('id', user.id).single(),
      supabase.from('workflow_statuses').select('id').eq('code', 'prospect_created').single(),
    ])

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
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
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    await sendNewPatientNotifications(
      supabase,
      { id: user.id, full_name: profile.full_name },
      { id: patient.id, patient_name }
    )

    return NextResponse.json({ success: true, patientId: patient.id })
  } catch (error) {
    log.error('Erreur création patient', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
