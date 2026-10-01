/**
 * Pipeline extract + synthèse pour un document patient (PDF / DOC DICOM).
 * Le chemin fiable est la lecture dans le navigateur (`extractReportTextFromFile`)
 * puis `persistSynthesisFromText`. Le téléchargement serveur reste un repli.
 * Aucun PHI dans les logs.
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role'
import {
  PATIENT_DOCUMENTS_BUCKET,
  isObjectKeyOwnedByPatient,
} from '@/lib/documents/patient-documents'
import { extractPdfText, sha256Hex } from '@/lib/documents/extract-pdf-text'
import { MAX_REPORT_TEXT_CHARS } from '@/lib/documents/extract-report-text'
import {
  reportHasExtractedContent,
  structureRadiologistReport,
  type ReportSection,
} from '@/lib/documents/structure-radiologist-report'
import { synthesizeRadiologistReport } from '@/lib/documents/synthesize-radiologist-report'
import { isRadiologistReportCandidate } from '@/lib/documents/report-candidates'
import { reportPdfAttempts } from '@/lib/documents/read-report-pdf'
import { Logger } from '@/lib/logger'

const log = new Logger('documents/report-pipeline')

export { isRadiologistReportCandidate }

export const REPORT_ROW_SELECT =
  'id, patient_id, document_id, status, sections, synthesis, synthesis_status, synthesis_model, synthesized_at, extracted_at, error_code, patient_documents(file_name, series_description, mime_type, kind, modality)'

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

export type PipelineResult = {
  document_id: string
  status: 'ok' | 'no_text' | 'error'
  synthesis_status: 'ok' | 'error' | 'skipped'
  error_code?: string | null
}

type Service = ReturnType<typeof createServiceRoleClient>

function extractFailureCode(err: unknown): string {
  const message = err instanceof Error ? err.message : ''
  if (/workerSrc|fake worker|ENOENT|Cannot find module/i.test(message)) return 'worker_unavailable'
  if (/standardFontDataUrl/i.test(message)) return 'extract_failed'
  return 'extract_failed'
}

async function composeFromText(text: string, fileName: string) {
  const trimmed = text.replace(/\u0000/g, '').trim().slice(0, MAX_REPORT_TEXT_CHARS)
  let sections = structureRadiologistReport(trimmed)
  if (trimmed.length > 0 && !reportHasExtractedContent(sections)) {
    sections = sections.map(s => (s.id === 'resultats' ? { ...s, text: trimmed, present: true } : s))
  }
  if (!trimmed) {
    return {
      status: 'no_text' as const,
      sections,
      error_code: 'no_text_layer',
      synthesis: null,
      synthesis_status: 'skipped' as const,
      synthesis_model: null,
    }
  }
  const { synthesis, model } = await synthesizeRadiologistReport({
    sections,
    rawText: trimmed,
    fileName,
  })
  return {
    status: 'ok' as const,
    sections,
    error_code: null,
    synthesis,
    synthesis_status: 'ok' as const,
    synthesis_model: model,
  }
}

async function upsertReport(
  service: Service,
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
  const { error } = await service.from('patient_document_reports').upsert(row, { onConflict: 'document_id' })
  if (error) {
    log.error('Erreur upsert rapport', { code: error.code })
    throw error
  }
}

/**
 * Retire les lignes d'erreur posées sur des fichiers qui ne sont pas des CR
 * (Phoenix ZIP, DICOMDIR, questionnaires).
 */
export async function forgetNonCandidateReports(patientId: string): Promise<void> {
  const service = createServiceRoleClient()
  const { data: reports, error } = await service
    .from('patient_document_reports')
    .select('id, document_id')
    .eq('patient_id', patientId)
  if (error || !reports?.length) return

  const { data: docs } = await service
    .from('patient_documents')
    .select('id, file_name, mime_type, kind, modality, series_description')
    .in(
      'id',
      reports.map(r => r.document_id),
    )

  const byId = new Map((docs ?? []).map(d => [d.id, d]))
  const drop = reports
    .filter(r => {
      const doc = byId.get(r.document_id)
      if (!doc) return true
      return !isRadiologistReportCandidate(doc)
    })
    .map(r => r.id)
  if (drop.length === 0) return

  const { error: deleteError } = await service.from('patient_document_reports').delete().in('id', drop)
  if (deleteError) log.error('Erreur purge rapports hors CR', { code: deleteError.code })
}

/**
 * Structure + synthèse à partir d'un texte déjà extrait (navigateur).
 * Le document doit appartenir au patient et être un vrai CR.
 */
export async function persistSynthesisFromText(
  patientId: string,
  doc: DocMeta,
  rawText: string,
): Promise<PipelineResult> {
  if (!isObjectKeyOwnedByPatient(doc.file_path, patientId)) {
    return {
      document_id: doc.id,
      status: 'error',
      synthesis_status: 'error',
      error_code: 'wrong_patient',
    }
  }

  const composed = await composeFromText(rawText, doc.file_name)
  const service = createServiceRoleClient()
  const source = new TextEncoder().encode(rawText.slice(0, MAX_REPORT_TEXT_CHARS))
  await upsertReport(service, {
    patient_id: patientId,
    document_id: doc.id,
    status: composed.status,
    sections: composed.sections,
    source_sha: sha256Hex(source),
    error_code: composed.error_code,
    synthesis: composed.synthesis,
    synthesis_status: composed.synthesis_status,
    synthesis_model: composed.synthesis_model,
  })
  return {
    document_id: doc.id,
    status: composed.status,
    synthesis_status: composed.synthesis_status,
    error_code: composed.error_code,
  }
}

/**
 * Repli serveur : télécharge, extrait, synthétise. Préférer le navigateur.
 */
export async function runReportPipeline(patientId: string, doc: DocMeta): Promise<PipelineResult> {
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
  const attempts = reportPdfAttempts(fileBuffer, {
    kind: doc.kind,
    fileName: doc.file_name,
    mimeType: doc.mime_type,
  })

  if (attempts.length === 0) {
    const errorCode = doc.kind === 'dicom' ? 'no_encapsulated_pdf' : 'not_a_pdf'
    await upsertReport(service, {
      patient_id: patientId,
      document_id: doc.id,
      status: 'error',
      sections: structureRadiologistReport(''),
      source_sha: sha256Hex(fileBuffer),
      error_code: errorCode,
      synthesis: null,
      synthesis_status: 'skipped',
      synthesis_model: null,
    })
    return {
      document_id: doc.id,
      status: 'error',
      synthesis_status: 'skipped',
      error_code: errorCode,
    }
  }

  let text = ''
  let used: Uint8Array | null = null
  let lastCode = 'extract_failed'
  for (const pdf of attempts) {
    try {
      const extracted = await extractPdfText(pdf)
      if (extracted.length >= text.length) {
        text = extracted
        used = pdf
      }
      if (text.length > 40) break
    } catch (err) {
      lastCode = extractFailureCode(err)
      log.error('Échec extraction PDF', { code: lastCode })
    }
  }

  if (!used) {
    await upsertReport(service, {
      patient_id: patientId,
      document_id: doc.id,
      status: 'error',
      sections: structureRadiologistReport(''),
      source_sha: sha256Hex(attempts[0]!),
      error_code: lastCode,
      synthesis: null,
      synthesis_status: 'error',
      synthesis_model: null,
    })
    return {
      document_id: doc.id,
      status: 'error',
      synthesis_status: 'error',
      error_code: lastCode,
    }
  }

  const composed = await composeFromText(text, doc.file_name)
  await upsertReport(service, {
    patient_id: patientId,
    document_id: doc.id,
    status: composed.status,
    sections: composed.sections,
    source_sha: sha256Hex(used),
    error_code: composed.error_code,
    synthesis: composed.synthesis,
    synthesis_status: composed.synthesis_status,
    synthesis_model: composed.synthesis_model,
  })
  return {
    document_id: doc.id,
    status: composed.status,
    synthesis_status: composed.synthesis_status,
    error_code: composed.error_code,
  }
}
