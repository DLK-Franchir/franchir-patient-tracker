/**
 * POST /api/patients/[id]/document-reports/from-text
 *
 * Le navigateur a déjà lu la couche texte du PDF (mêmes octets que la visionneuse).
 * Ici : structuration + synthèse, upsert. Le corps ne contient que documentId + texte.
 * Aucun log du texte (PHI).
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { assertStaffProfile } from '@/lib/access-control'
import { denyIfOutOfRoleScope } from '@/lib/patient-role-scope-guard'
import { isRadiologistReportCandidate } from '@/lib/documents/report-candidates'
import {
  persistSynthesisFromText,
  REPORT_ROW_SELECT,
  type DocMeta,
} from '@/lib/documents/report-pipeline'
import { MAX_REPORT_TEXT_CHARS } from '@/lib/documents/extract-report-text'
import { Logger } from '@/lib/logger'

const log = new Logger('api/patients/document-reports/from-text')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const bodySchema = z.object({
  documentId: z.string().regex(UUID_RE),
  text: z.string().max(MAX_REPORT_TEXT_CHARS + 8_000),
})

export const maxDuration = 60

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: patientId } = await params
  if (!UUID_RE.test(patientId)) {
    return NextResponse.json({ error: 'Identifiant patient invalide' }, { status: 400 })
  }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
  }

  const service = createServiceRoleClient()
  const { data: doc, error: fetchError } = await service
    .from('patient_documents')
    .select('id, patient_id, file_path, file_name, mime_type, kind, modality, series_description')
    .eq('id', parsed.data.documentId)
    .eq('patient_id', patientId)
    .maybeSingle()

  if (fetchError) {
    log.error('Erreur lecture document', { code: fetchError.code })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
  if (!doc) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })
  if (!isRadiologistReportCandidate(doc)) {
    return NextResponse.json({ error: 'Ce fichier n’est pas un compte rendu' }, { status: 422 })
  }

  try {
    await persistSynthesisFromText(patientId, doc as DocMeta, parsed.data.text)
  } catch {
    log.error('Synthèse depuis texte en échec', { code: 'pipeline' })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }

  const { data: saved } = await service
    .from('patient_document_reports')
    .select(REPORT_ROW_SELECT)
    .eq('document_id', doc.id)
    .maybeSingle()

  return NextResponse.json({ report: saved })
}
