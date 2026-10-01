/**
 * POST /api/patients/[id]/document-reports/auto-synthesize
 *
 * Déclenche automatiquement extract + synthèse pour tous les PDF / DOC
 * radiologues du dossier (hors questionnaires). Idempotent.
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { assertStaffProfile } from '@/lib/access-control'
import { denyIfOutOfRoleScope } from '@/lib/patient-role-scope-guard'
import { reportNeedsFreshSynthesis } from '@/lib/documents/report-candidates'
import {
  forgetNonCandidateReports,
  isRadiologistReportCandidate,
  REPORT_ROW_SELECT,
  runReportPipeline,
  type DocMeta,
} from '@/lib/documents/report-pipeline'
import { Logger } from '@/lib/logger'

const log = new Logger('api/patients/document-reports/auto-synthesize')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Garde-fou serverless : max CR traités par appel. */
const MAX_PER_RUN = 4

export const maxDuration = 60

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { data: docs, error: docsError } = await service
    .from('patient_documents')
    .select('id, patient_id, file_path, file_name, mime_type, kind, modality, series_description')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (docsError) {
    log.error('Erreur listing documents', { code: docsError.code })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }

  const candidates = ((docs ?? []) as DocMeta[]).filter(isRadiologistReportCandidate)

  const { data: existing } = await service
    .from('patient_document_reports')
    .select('document_id, status, synthesis_status, synthesis_model, error_code, source_sha')
    .eq('patient_id', patientId)
    .in(
      'document_id',
      candidates.map(c => c.id),
    )

  const force = _req.headers.get('x-franchir-force') === '1'

  const done = new Set(
    (existing ?? [])
      .filter(r => !reportNeedsFreshSynthesis(r, force))
      .map((r: { document_id: string }) => r.document_id),
  )

  const todo = candidates.filter(c => !done.has(c.id)).slice(0, MAX_PER_RUN)
  const results = []
  for (const doc of todo) {
    try {
      results.push(await runReportPipeline(patientId, doc))
    } catch {
      log.error('Pipeline CR en échec', { code: 'pipeline' })
      results.push({
        document_id: doc.id,
        status: 'error' as const,
        synthesis_status: 'error' as const,
        error_code: 'pipeline',
      })
    }
  }

  const { data: reports } = await service
    .from('patient_document_reports')
    .select(REPORT_ROW_SELECT)
    .eq('patient_id', patientId)
    .order('synthesized_at', { ascending: false, nullsFirst: false })

  return NextResponse.json({
    processed: results,
    remaining: Math.max(0, candidates.filter(c => !done.has(c.id)).length - todo.length),
    reports: reports ?? [],
  })
}
