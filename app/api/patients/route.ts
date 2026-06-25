import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { Logger } from '@/lib/logger'
import { canCreatePatient } from '@/lib/access-control'
import { parseQuestionnaireLanguage } from '@/lib/integrations/questionnaire-language'
import { parseFormTypesInput } from '@/lib/integrations/questionnaire-form-types'
import { sendNewPatientNotifications } from '@/lib/notifications'
import { issueQuestionnaireLink } from '@/lib/integrations/issue-questionnaire-link'

const log = new Logger('api/patients')

export async function POST(req: Request) {
  try {
    const { patient_name, patient_email, patient_phone, clinical_summary, sharepoint_link, form_types, questionnaire_language } =
      await req.json()

    if (!patient_name) {
      return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 })
    }

    const formTypes = parseFormTypesInput(form_types) ?? ['cervical']

    const language = parseQuestionnaireLanguage(questionnaire_language, 'fr')

    const normalizedPhone =
      typeof patient_phone === 'string' && patient_phone.trim().length > 0
        ? patient_phone.trim()
        : null

    if (normalizedPhone && normalizedPhone.length > 50) {
      return NextResponse.json(
        { error: 'Numero de telephone trop long (50 caracteres maximum)' },
        { status: 400 },
      )
    }

    // Email patient (D1) : requis pour l'envoi automatique du questionnaire.
    // Validation minimale (format) — la saisie complète est validée côté UI.
    if (!patient_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patient_email)) {
      return NextResponse.json({ error: 'Email patient invalide ou manquant' }, { status: 400 })
    }

    const supabase = await createServerClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [{ data: profile }, { data: status }] = await Promise.all([
      supabase.from('profiles').select('role, full_name, email').eq('id', user.id).single(),
      supabase.from('workflow_statuses').select('id').eq('code', 'prospect_created').single(),
    ])

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    if (!canCreatePatient(profile)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: patient, error: insertError } = await supabase
      .from('patients')
      .insert({
        patient_name,
        patient_email,
        patient_phone: normalizedPhone,
        questionnaire_language: language,
        clinical_summary,
        sharepoint_link: sharepoint_link ?? null,
        form_types: formTypes,
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

    // Envoi automatique du lien questionnaire (D1) — best-effort après sync webhook.
    const linkResult = await issueQuestionnaireLink({
      patientId: patient.id,
      newSession: false,
      language,
    })
    if (!linkResult.ok) {
      log.warn('Envoi auto lien questionnaire echoue a la creation', {
        patientId: patient.id,
        code: linkResult.code,
        error: linkResult.error,
      })
    } else if (!linkResult.emailSent) {
      log.warn('Lien questionnaire genere sans email patient (Resend?)', {
        patientId: patient.id,
      })
    }

    return NextResponse.json({
      success: true,
      patientId: patient.id,
      questionnaireEmailSent: linkResult.ok ? linkResult.emailSent : false,
      questionnaireLinkError: linkResult.ok ? null : linkResult.error,
    })
  } catch (error) {
    log.error('Erreur création patient', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}