/**
 * Confirmation staff : Marcel a bien envoyé le message (copie / mailto / WhatsApp).
 * Marque questionnaire_status = sent sans réémettre le lien.
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { canManagePatientDocuments, type StaffRole } from '@/lib/access-control'
import { denyIfArchivedPatientWrite } from '@/lib/patient-archive-guard'
import { denyIfOutOfRoleScope } from '@/lib/patient-role-scope-guard'
import { markQuestionnaireLinkIssued } from '@/lib/integrations/issue-questionnaire-link'
import { coercePatientFormTypes } from '@/lib/integrations/questionnaire-form-types'
import { logPatientAction } from '@/lib/patient-messages/log-action'
import { formatQuestionnaireAuditBodyFromFormTypes } from '@/lib/patient-messages/questionnaire-audit-copy'
import { Logger } from '@/lib/logger'

const log = new Logger('api/patients/questionnaire-dispatch-confirm')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
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
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (!profile || !canManagePatientDocuments(profile)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const scopeDeny = await denyIfOutOfRoleScope(
    supabase,
    patientId,
    profile.role as StaffRole,
  )
  if (scopeDeny) return scopeDeny

  const archivedDeny = await denyIfArchivedPatientWrite(
    supabase,
    patientId,
    profile.role as StaffRole,
  )
  if (archivedDeny) return archivedDeny

  const { data: patient } = await supabase
    .from('patients')
    .select('questionnaire_status, questionnaire_language, form_types')
    .eq('id', patientId)
    .maybeSingle()

  if (!patient) {
    return NextResponse.json({ error: 'Patient introuvable' }, { status: 404 })
  }

  if (patient.questionnaire_status === 'completed') {
    return NextResponse.json(
      {
        error:
          'Questionnaire déjà complété — pour une nouvelle évaluation, créez un nouveau dossier patient.',
      },
      { status: 409 },
    )
  }

  try {
    await markQuestionnaireLinkIssued(patientId, true)

    const language = patient.questionnaire_language === 'en' ? 'en' : 'fr'
    const formTypes = coercePatientFormTypes(patient.form_types)

    await logPatientAction(
      supabase,
      {
        patientId,
        author: {
          id: user.id,
          full_name: profile.full_name ?? null,
          role: profile.role ?? 'staff',
        },
        kind: 'action',
        title: 'Envoi questionnaire confirmé',
        body: formatQuestionnaireAuditBodyFromFormTypes({
          formTypes,
          language,
          sendNote: 'Envoi staff confirmé (copie / mailto / messagerie).',
        }),
        topic: 'audit',
        meta: {
          action_id: 'questionnaire_staff_dispatch',
          questionnaire_language: language,
          form_types: formTypes,
          dispatch_channel: 'staff',
        },
      },
      log,
      { action: 'questionnaire_dispatch_confirm' },
    )

    return NextResponse.json({ success: true, questionnaireStatus: 'sent' })
  } catch (error) {
    log.error('Erreur confirmation dispatch questionnaire', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
