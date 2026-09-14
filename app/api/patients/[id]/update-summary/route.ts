import { createServerClient } from '@/lib/supabase/server'
import { canEditPatientSummary, type StaffRole } from '@/lib/access-control'
import { denyIfArchivedPatientWrite } from '@/lib/patient-archive-guard'
import { denyIfOutOfRoleScope } from '@/lib/patient-role-scope-guard'
import { logPatientAction } from '@/lib/patient-messages/log-action'
import { buildSummaryEditMeta } from '@/lib/patient-messages/action-meta'
import { Logger } from '@/lib/logger'
import { NextResponse } from 'next/server'

const log = new Logger('api/patients/update-summary')

const SUMMARY_FIELD_LABELS = {
  clinical_summary: 'résumé clinique',
  sharepoint_link: 'lien SharePoint',
} as const

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: patientId } = await params
  const { clinical_summary, sharepoint_link } = await req.json()

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

  if (!profile || !canEditPatientSummary(profile)) {
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

  // État AVANT update : seuls les noms de champs modifiés seront journalisés.
  const { data: previous } = await supabase
    .from('patients')
    .select('clinical_summary, sharepoint_link')
    .eq('id', patientId)
    .maybeSingle()

  const { error } = await supabase
    .from('patients')
    .update({
      clinical_summary,
      sharepoint_link,
    })
    .eq('id', patientId)

  if (error) {
    console.error('Erreur mise à jour patient:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const edit = buildSummaryEditMeta(
    {
      clinical_summary: previous?.clinical_summary,
      sharepoint_link: previous?.sharepoint_link,
    },
    { clinical_summary, sharepoint_link },
  )
  if (edit) {
    await logPatientAction(
      supabase,
      {
        patientId,
        author: { id: user.id, full_name: profile.full_name, role: profile.role },
        kind: 'action',
        title: 'Fiche patient modifiée',
        body: `Champs modifiés : ${edit.fieldsChanged
          .map((field) => SUMMARY_FIELD_LABELS[field])
          .join(', ')}.`,
        topic: 'audit',
        meta: edit.meta,
      },
      log,
      { action: 'edit_summary' },
    )
  }

  return NextResponse.json({ success: true })
}