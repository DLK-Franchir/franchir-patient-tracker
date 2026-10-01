/**
 * Quels fichiers du dossier sont de vrais comptes rendus radiologues.
 * Exclut questionnaires, PDF techniques de CD (licence, viewer) et artefacts.
 */

import { isTechnicalDocumentName, REPORT_READ_REV } from '@/lib/documents/report-triage'

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
  const fileName = (doc.file_name ?? doc.fileName ?? '').trim()
  const series = (doc.series_description ?? doc.seriesDescription ?? '').trim()
  const blob = `${fileName} ${series}`.toLowerCase()

  if (isTechnicalDocumentName(blob)) return false
  if (/questionnaire|anamneze|consentement|\bndi\b|\bodi\b/.test(blob)) return false

  const mime = (doc.mime_type ?? doc.mimeType ?? '').toLowerCase()
  const lowerName = fileName.toLowerCase()
  if (mime === 'application/pdf' || lowerName.endsWith('.pdf') || doc.renderType === 'pdf') {
    return true
  }

  if (doc.kind !== 'dicom') return false
  const modality = (doc.modality ?? '').toUpperCase()
  if (modality === 'DOC') return true
  return /report pdf|compte[\s-]?rendu|cr radiolog/.test(blob)
}

/**
 * Un CR déjà réussi ou un scan sans couche texte ne doit pas être relu.
 * Les erreurs (extract serveur, PDF non trouvé) sont retentées.
 */
export function reportNeedsFreshSynthesis(
  row: {
    status?: string | null
    synthesis_status?: string | null
    synthesis_model?: string | null
    error_code?: string | null
  } | null | undefined,
  force: boolean,
): boolean {
  if (force || !row) return true
  if (row.error_code === 'off_topic') return false
  if (row.status === 'no_text' && row.synthesis_status === 'skipped') return false
  if (row.synthesis_status === 'ok') {
    return !(row.synthesis_model ?? '').includes(REPORT_READ_REV)
  }
  return true
}
