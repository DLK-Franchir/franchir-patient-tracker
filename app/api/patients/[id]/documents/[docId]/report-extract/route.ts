/**
 * POST /api/patients/[id]/documents/[docId]/report-extract
 * Relance extract + synthèse pour un document (retry manuel).
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { assertStaffProfile } from '@/lib/access-control'
import { denyIfOutOfRoleScope } from '@/lib/patient-role-scope-guard'
import { isRadiologistReportCandidate } from '@/lib/documents/report-candidates'
import { REPORT_ROW_SELECT, runReportPipeline, type DocMeta } from '@/lib/documents/report-pipeline'
import { Logger } from '@/lib/logger'

const log = new Logger('api/patients/documents/report-extract')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const { id: patientId, docId } = await params
  if (!UUID_RE.test(patientId) || !UUID_RE.test(docId)) {
    return NextResponse.json({ error: 'Identifiant invalide' }, { status: 400 })
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
  const { data: doc, error: fetchError } = await service
    .from('patient_documents')
    .select('id, patient_id, file_path, file_name, mime_type, kind, modality, series_description')
    .eq('id', docId)
    .eq('patient_id', patientId)
    .maybeSingle()

  if (fetchError) {
    log.error('Erreur lecture métadonnées document', { code: fetchError.code })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
  if (!doc) {
    return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })
  }
  if (!isRadiologistReportCandidate(doc)) {
    return NextResponse.json({ error: 'Ce fichier n’est pas un compte rendu' }, { status: 422 })
  }

  try {
    const result = await runReportPipeline(patientId, doc as DocMeta)
    const { data: saved } = await service
      .from('patient_document_reports')
      .select(
        REPORT_ROW_SELECT,
      )
      .eq('document_id', docId)
      .maybeSingle()
    return NextResponse.json({ report: saved, result })
  } catch {
    log.error('Pipeline CR en échec', { code: 'pipeline' })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
