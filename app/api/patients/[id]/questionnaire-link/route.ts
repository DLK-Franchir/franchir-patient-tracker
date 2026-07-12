/**
 * Émission du lien questionnaire patient PILOTÉE depuis le cockpit tracker
 * (orchestration). Le tracker ne génère pas le lien lui-même : il délègue à
 * l'app questionnaires (source de vérité) via l'endpoint service-token
 * `/api/integrations/tracker/questionnaire-link`, corrélé par l'id patient
 * tracker (= `external_tracker_id` côté questionnaires).
 *
 * Réservé au staff gestionnaire (marcel / franchir / admin). Le token de pont
 * ne quitte jamais le serveur. À la réussite, on note l'état `sent` côté tracker
 * uniquement si l'email patient a bien été expédié (Resend côté questionnaires).
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { canManagePatientDocuments, type StaffRole } from '@/lib/access-control'
import { denyIfArchivedPatientWrite } from '@/lib/patient-archive-guard'
import { parseQuestionnaireLanguageFromLinkBody } from '@/lib/integrations/questionnaire-language'
import { parseFormTypesInput, coercePatientFormTypes } from '@/lib/integrations/questionnaire-form-types'
import { issueQuestionnaireLink } from '@/lib/integrations/issue-questionnaire-link'
import { logPatientAction } from '@/lib/patient-messages/log-action'
import {
  formatQuestionnaireAuditBodyFromFormTypes,
  formatQuestionnaireResendNote,
} from '@/lib/patient-messages/questionnaire-audit-copy'
import { Logger } from '@/lib/logger'

const log = new Logger('api/patients/questionnaire-link')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: patientId } = await params
  if (!UUID_RE.test(patientId)) {
    return NextResponse.json({ error: 'Identifiant patient invalide' }, { status: 400 })
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
    .select('role, email, full_name')
    .eq('id', user.id)
    .single()

  if (!profile || !canManagePatientDocuments(profile)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const archivedDeny = await denyIfArchivedPatientWrite(
    supabase,
    patientId,
    profile.role as StaffRole,
  )
  if (archivedDeny) return archivedDeny

  const body = await req.json().catch(() => ({}))
  const newSession = Boolean(body?.newSession)
  const language = parseQuestionnaireLanguageFromLinkBody(body)
  const formTypes = parseFormTypesInput(body?.formTypes)

  const { data: patientRow } = await supabase
    .from('patients')
    .select('questionnaire_language, form_types')
    .eq('id', patientId)
    .single()

  try {
    const result = await issueQuestionnaireLink({
      patientId,
      newSession,
      language,
      formTypes,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.httpStatus })
    }

    const { data: patientAfter } = await supabase
      .from('patients')
      .select('questionnaire_language, form_types')
      .eq('id', patientId)
      .single()

    const resolvedLanguage =
      patientAfter?.questionnaire_language === 'en' ? 'en' : 'fr'
    const resolvedFormTypes = coercePatientFormTypes(
      patientAfter?.form_types ?? patientRow?.form_types,
    )
    const effectiveNewSession = result.effectiveNewSession

    await logPatientAction(
      supabase,
      {
        patientId,
        author: {
          id: user.id,
          full_name: profile?.full_name ?? null,
          role: profile?.role ?? 'staff',
        },
        kind: 'action',
        title: effectiveNewSession ? 'Nouveau questionnaire émis' : 'Lien questionnaire renvoyé',
        body: formatQuestionnaireAuditBodyFromFormTypes({
          formTypes: resolvedFormTypes,
          language: resolvedLanguage,
          sendNote: formatQuestionnaireResendNote(result.emailSent),
        }),
        topic: 'audit',
        meta: {
          action_id: effectiveNewSession ? 'questionnaire_new_session' : 'questionnaire_resend',
          questionnaire_language: resolvedLanguage,
          form_types: resolvedFormTypes,
          email_sent: result.emailSent,
        },
      },
      log,
      { action: 'questionnaire_link' },
    )

    return NextResponse.json({
      success: true,
      emailSent: result.emailSent,
      expiresAt: result.expiresAt,
    })
  } catch (error) {
    log.error('Erreur émission lien questionnaire', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
