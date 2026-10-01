/**
 * POST /api/patients/[id]/documents/[docId]/report-extract
 *
 * Synthèse extractive d'un PDF (classique ou encapsulé DICOM DOC).
 * Staff authentifié + scope patient. Aucun extrait dans les logs.
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { assertStaffProfile } from '@/lib/access-control'
import { denyIfOutOfRoleScope } from '@/lib/patient-role-scope-guard'
import {
  PATIENT_DOCUMENTS_BUCKET,
  isObjectKeyOwnedByPatient,
} from '@/lib/documents/patient-documents'
import { extractPdfText, sha256Hex } from '@/lib/documents/extract-pdf-text'
import {
  reportHasExtractedContent,
  structureRadiologistReport,
  type ReportSection,
} from '@/lib/documents/structure-radiologist-report'
import { extractEncapsulatedPdf } from '@/lib/imaging/dicom-content'
import { Logger } from '@/lib/logger'

const log = new Logger('api/patients/documents/report-extract')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type DocRow = {
  id: string
  patient_id: string
  file_path: string
  file_name: string
  mime_type: string | null
  kind: string
  modality: string | null
}

function looksLikePdf(name: string, mime: string | null): boolean {
  const t = (mime ?? '').toLowerCase()
  if (t === 'application/pdf') return true
  return name.toLowerCase().endsWith('.pdf')
}

async function resolvePdfBytes(
  fileBytes: Uint8Array,
  row: DocRow,
): Promise<{ pdf: Uint8Array } | { error: string }> {
  if (looksLikePdf(row.file_name, row.mime_type)) {
    return { pdf: fileBytes }
  }
  if (row.kind === 'dicom') {
    const encapsulated = extractEncapsulatedPdf(fileBytes)
    if (encapsulated && encapsulated.byteLength > 0) {
      return { pdf: encapsulated }
    }
    return { error: 'no_encapsulated_pdf' }
  }
  return { error: 'unsupported_mime' }
}

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
    .select('id, patient_id, file_path, file_name, mime_type, kind, modality')
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

  const row = doc as DocRow
  if (!isObjectKeyOwnedByPatient(row.file_path, patientId)) {
    return NextResponse.json({ error: 'Document non rattaché au patient' }, { status: 400 })
  }

  const { data: blob, error: downloadError } = await service.storage
    .from(PATIENT_DOCUMENTS_BUCKET)
    .download(row.file_path)

  if (downloadError || !blob) {
    log.error('Erreur téléchargement Storage', { code: downloadError?.message ? 'storage' : 'empty' })
    return NextResponse.json({ error: 'Fichier inaccessible' }, { status: 502 })
  }

  const fileBuffer = new Uint8Array(await blob.arrayBuffer())
  const resolved = await resolvePdfBytes(fileBuffer, row)

  if ('error' in resolved) {
    const sections: ReportSection[] = structureRadiologistReport('')
    const payload = {
      patient_id: patientId,
      document_id: docId,
      status: 'error' as const,
      sections,
      source_sha: sha256Hex(fileBuffer),
      extracted_at: new Date().toISOString(),
      error_code: resolved.error,
    }
    const { data: saved, error: upsertError } = await service
      .from('patient_document_reports')
      .upsert(payload, { onConflict: 'document_id' })
      .select(
        'id, patient_id, document_id, status, sections, source_sha, extracted_at, error_code',
      )
      .single()
    if (upsertError) {
      log.error('Erreur upsert rapport', { code: upsertError.code })
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
    return NextResponse.json({ report: saved })
  }

  let text = ''
  try {
    text = await extractPdfText(resolved.pdf)
  } catch (err) {
    const reason =
      err instanceof Error && /workerSrc|fake worker|ENOENT|Cannot find module/i.test(err.message)
        ? 'worker_unavailable'
        : 'extract_failed'
    log.error('Échec extraction pdf.js', { code: reason })
    const sections = structureRadiologistReport('')
    const payload = {
      patient_id: patientId,
      document_id: docId,
      status: 'error' as const,
      sections,
      source_sha: sha256Hex(resolved.pdf),
      extracted_at: new Date().toISOString(),
      error_code: reason,
    }
    const { data: saved, error: upsertError } = await service
      .from('patient_document_reports')
      .upsert(payload, { onConflict: 'document_id' })
      .select(
        'id, patient_id, document_id, status, sections, source_sha, extracted_at, error_code',
      )
      .single()
    if (upsertError) {
      log.error('Erreur upsert rapport', { code: upsertError.code })
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
    return NextResponse.json({ report: saved })
  }

  const sections = structureRadiologistReport(text)
  const hasContent = text.length > 0 && reportHasExtractedContent(sections)
  const status = text.length === 0 ? 'no_text' : hasContent || text.length > 0 ? 'ok' : 'no_text'

  // Si texte présent mais aucun titre de section : une section « Résultats » porte le brut.
  let finalSections = sections
  if (text.length > 0 && !reportHasExtractedContent(sections)) {
    finalSections = sections.map(s =>
      s.id === 'resultats'
        ? { ...s, text, present: true }
        : s,
    )
  }

  const payload = {
    patient_id: patientId,
    document_id: docId,
    status: status as 'ok' | 'no_text',
    sections: finalSections,
    source_sha: sha256Hex(resolved.pdf),
    extracted_at: new Date().toISOString(),
    error_code: status === 'no_text' ? 'no_text_layer' : null,
  }

  const { data: saved, error: upsertError } = await service
    .from('patient_document_reports')
    .upsert(payload, { onConflict: 'document_id' })
    .select(
      'id, patient_id, document_id, status, sections, source_sha, extracted_at, error_code, patient_documents(file_name)',
    )
    .single()

  if (upsertError) {
    log.error('Erreur upsert rapport', { code: upsertError.code })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }

  return NextResponse.json({ report: saved })
}
