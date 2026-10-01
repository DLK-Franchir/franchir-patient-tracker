/**
 * Pipeline extract + synthèse pour un document patient (PDF / DOC DICOM).
 * Aucun PHI dans les logs.
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role'
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
import { synthesizeRadiologistReport } from '@/lib/documents/synthesize-radiologist-report'
import { extractEncapsulatedPdf } from '@/lib/imaging/dicom-content'
import { findPdfSlice } from '@/lib/documents/pdf-bytes'
import { Logger } from '@/lib/logger'

const log = new Logger('documents/report-pipeline')

export type DocMeta = {
  id: string
  patient_id: string
  file_path: string
  file_name: string
  mime_type: string | null
  kind: string
  modality: string | null
  series_description?: string | null
}

function looksLikePdf(name: string, mime: string | null): boolean {
  const t = (mime ?? '').toLowerCase()
  if (t === 'application/pdf') return true
  return name.toLowerCase().endsWith('.pdf')
}

/** Documents éligibles à une synthèse CR (exclut questionnaires patients). */
export function isRadiologistReportCandidate(doc: {
  file_name?: string | null
  fileName?: string | null
  kind: string
  mime_type?: string | null
  mimeType?: string | null
  modality?: string | null
  series_description?: string | null
  seriesDescription?: string | null
  renderType?: string | null
}): boolean {
  const name = `${doc.file_name ?? doc.fileName ?? ''} ${doc.series_description ?? doc.seriesDescription ?? ''}`.toLowerCase()
  if (/questionnaire|anamneze|consentement|\bndi\b|\bodi\b/.test(name)) return false

  const mime = (doc.mime_type ?? doc.mimeType ?? '').toLowerCase()
  const fileName = (doc.file_name ?? doc.fileName ?? '').toLowerCase()
  if (mime === 'application/pdf' || fileName.endsWith('.pdf') || doc.renderType === 'pdf') {
    return true
  }

  if (doc.kind === 'dicom') {
    const mod = (doc.modality ?? '').toUpperCase()
    if (mod === 'DOC') return true
    if (/report|compte.?rendu|radiolog|\bcr\b/.test(name)) return true
  }
  return false
}

async function resolvePdfBytes(
  fileBytes: Uint8Array,
  row: DocMeta,
): Promise<{ pdf: Uint8Array } | { error: string }> {
  if (looksLikePdf(row.file_name, row.mime_type)) {
    const pdf = findPdfSlice(fileBytes)
    return pdf ? { pdf } : { error: 'not_a_pdf' }
  }
  if (row.kind === 'dicom') {
    const encapsulated = extractEncapsulatedPdf(fileBytes)
    const fromTag = encapsulated ? findPdfSlice(encapsulated) : null
    if (fromTag && fromTag.byteLength > 8) return { pdf: fromTag }
    // Le parseur DICOM peut rater le tag : on cherche %PDF dans le fichier.
    const embedded = findPdfSlice(fileBytes)
    if (embedded && embedded.byteLength > 8) return { pdf: embedded }
    return { error: 'no_encapsulated_pdf' }
  }
  return { error: 'unsupported_mime' }
}

export type PipelineResult = {
  document_id: string
  status: 'ok' | 'no_text' | 'error'
  synthesis_status: 'ok' | 'error' | 'skipped'
  error_code?: string | null
}

/**
 * Télécharge, extrait, structure et synthétise un document. Upsert en base.
 */
export async function runReportPipeline(
  patientId: string,
  doc: DocMeta,
): Promise<PipelineResult> {
  const service = createServiceRoleClient()

  if (!isObjectKeyOwnedByPatient(doc.file_path, patientId)) {
    return {
      document_id: doc.id,
      status: 'error',
      synthesis_status: 'error',
      error_code: 'wrong_patient',
    }
  }

  const { data: blob, error: downloadError } = await service.storage
    .from(PATIENT_DOCUMENTS_BUCKET)
    .download(doc.file_path)

  if (downloadError || !blob) {
    log.error('Erreur téléchargement Storage', { code: 'storage' })
    return {
      document_id: doc.id,
      status: 'error',
      synthesis_status: 'error',
      error_code: 'storage',
    }
  }

  const fileBuffer = new Uint8Array(await blob.arrayBuffer())
  const resolved = await resolvePdfBytes(fileBuffer, doc)

  if ('error' in resolved) {
    const sections = structureRadiologistReport('')
    await upsertReport(service, {
      patient_id: patientId,
      document_id: doc.id,
      status: 'error',
      sections,
      source_sha: sha256Hex(fileBuffer),
      error_code: resolved.error,
      synthesis: null,
      synthesis_status: 'skipped',
      synthesis_model: null,
    })
    return {
      document_id: doc.id,
      status: 'error',
      synthesis_status: 'skipped',
      error_code: resolved.error,
    }
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
    await upsertReport(service, {
      patient_id: patientId,
      document_id: doc.id,
      status: 'error',
      sections: structureRadiologistReport(''),
      source_sha: sha256Hex(resolved.pdf),
      error_code: reason,
      synthesis: null,
      synthesis_status: 'error',
      synthesis_model: null,
    })
    return {
      document_id: doc.id,
      status: 'error',
      synthesis_status: 'error',
      error_code: reason,
    }
  }

  let sections = structureRadiologistReport(text)
  if (text.length > 0 && !reportHasExtractedContent(sections)) {
    sections = sections.map(s =>
      s.id === 'resultats' ? { ...s, text, present: true } : s,
    )
  }

  const extractStatus: 'ok' | 'no_text' = text.length === 0 ? 'no_text' : 'ok'

  if (extractStatus === 'no_text') {
    await upsertReport(service, {
      patient_id: patientId,
      document_id: doc.id,
      status: 'no_text',
      sections,
      source_sha: sha256Hex(resolved.pdf),
      error_code: 'no_text_layer',
      synthesis: null,
      synthesis_status: 'skipped',
      synthesis_model: null,
    })
    return {
      document_id: doc.id,
      status: 'no_text',
      synthesis_status: 'skipped',
      error_code: 'no_text_layer',
    }
  }

  const { synthesis, model } = await synthesizeRadiologistReport({
    sections,
    rawText: text,
    fileName: doc.file_name,
  })

  await upsertReport(service, {
    patient_id: patientId,
    document_id: doc.id,
    status: 'ok',
    sections,
    source_sha: sha256Hex(resolved.pdf),
    error_code: null,
    synthesis,
    synthesis_status: 'ok',
    synthesis_model: model,
  })

  return {
    document_id: doc.id,
    status: 'ok',
    synthesis_status: 'ok',
  }
}

async function upsertReport(
  service: ReturnType<typeof createServiceRoleClient>,
  payload: {
    patient_id: string
    document_id: string
    status: 'ok' | 'no_text' | 'error'
    sections: ReportSection[]
    source_sha: string
    error_code: string | null
    synthesis: unknown
    synthesis_status: 'ok' | 'error' | 'skipped' | 'pending'
    synthesis_model: string | null
  },
) {
  const row = {
    ...payload,
    extracted_at: new Date().toISOString(),
    synthesized_at: payload.synthesis ? new Date().toISOString() : null,
  }
  const { error } = await service
    .from('patient_document_reports')
    .upsert(row, { onConflict: 'document_id' })
  if (error) {
    log.error('Erreur upsert rapport', { code: error.code })
    throw error
  }
}
