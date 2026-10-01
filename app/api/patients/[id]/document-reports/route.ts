/**
 * GET /api/patients/[id]/document-reports
 * Liste les synthèses extractives déjà calculées pour le dossier.
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { assertStaffProfile } from '@/lib/access-control'
import { denyIfOutOfRoleScope } from '@/lib/patient-role-scope-guard'
import { isRadiologistReportCandidate } from '@/lib/documents/report-candidates'
import { forgetNonCandidateReports, REPORT_ROW_SELECT } from '@/lib/documents/report-pipeline'
import { Logger } from '@/lib/logger'

const log = new Logger('api/patients/document-reports')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
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
    .select('role, email')
    .eq('id', user.id)
    .single()

  if (!assertStaffProfile(profile)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const scopeDeny = await denyIfOutOfRoleScope(supabase, patientId, profile.role)
  if (scopeDeny) return scopeDeny

  const service = createServiceRoleClient()
  await forgetNonCandidateReports(patientId)

  const { data, error } = await service
    .from('patient_document_reports')
    .select(REPORT_ROW_SELECT)
    .eq('patient_id', patientId)
    .order('extracted_at', { ascending: false })

  if (error) {
    log.error('Erreur listing rapports', { code: error.code })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }

  const reports = (data ?? []).filter(row => {
    const rel = row.patient_documents
    const doc = Array.isArray(rel) ? rel[0] : rel
    if (!doc) return false
    return isRadiologistReportCandidate({
      file_name: doc.file_name,
      kind: doc.kind ?? 'document',
      mime_type: doc.mime_type,
      modality: doc.modality,
      series_description: doc.series_description,
    })
  })

  return NextResponse.json({ reports })
}
