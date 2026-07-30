import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { Logger } from '@/lib/logger'
import { canCreatePatient } from '@/lib/access-control'
import { parseQuestionnaireLanguage } from '@/lib/integrations/questionnaire-language'
import { parseFormTypesInput } from '@/lib/integrations/questionnaire-form-types'
import { sendNewPatientNotifications } from '@/lib/notifications'
import { logPatientAction } from '@/lib/patient-messages/log-action'
import {
  formatPatientCreationAuditBody,
  formatQuestionnaireCreationNote,
} from '@/lib/patient-messages/questionnaire-audit-copy'

const log = new Logger('api/patients')

export async function POST(req: Request) {
  try {
    const { patient_name, patient_email, patient_phone, clinical_summary, sharepoint_link, form_types, questionnaire_language } =
      await req.json()

    if (!patient_name) {
      return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 })
    }

    const formTypes = parseFormTypesInput(form_types) ?? ['cervical']

    const language = parseQuestionnaireLanguage(questionnaire_language, 'fr') ?? 'fr'

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

    // Email patient requis pour le dispatch staff (copie / mailto) depuis la fiche.
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

    // Plus d'émission auto Resend à la création — Marcel prépare depuis la fiche.
    const sendNote = formatQuestionnaireCreationNote({ deferred: true })

    await logPatientAction(
      supabase,
      {
        patientId: patient.id,
        author: { id: user.id, full_name: profile.full_name, role: profile.role },
        kind: 'system',
        title: 'Dossier créé',
        body: formatPatientCreationAuditBody({
          authorName: profile.full_name,
          formTypes,
          language,
          sendNote,
        }),
        topic: 'audit',
        meta: {
          action_id: 'create_patient',
          questionnaire_language: language,
          form_types: formTypes,
          questionnaire_email_sent: false,
          questionnaire_dispatch_deferred: true,
        },
      },
      log,
      { action: 'create_patient' },
    )

    return NextResponse.json({
      success: true,
      patientId: patient.id,
      questionnaireEmailSent: false,
      questionnaireLinkError: null,
      questionnaireDispatchDeferred: true,
    })
  } catch (error) {
    log.error('Erreur création patient', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
