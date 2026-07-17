/**
 * Payload pont questionnaires ← tracker (patient-documents).
 * Inclut les métadonnées DICOM persistées — sans elles le clinicien regroupe
 * chaque coupe en « série » (noms 33230000_*.dcm).
 */

import type { PatientDocument } from '@/lib/documents/patient-documents'

export type QuestionnairesImagingDocument = {
  fileName: string
  url: string
  renderType: 'dicom' | 'pdf' | 'image' | 'other'
  sizeBytes?: number | null
  sopInstanceUid?: string | null
  seriesInstanceUid?: string | null
  seriesDescription?: string | null
  bodyPart?: string | null
  instanceNumber?: number | null
  acquisitionDatetime?: string | null
}

/** Mappe un document tracker vers le contrat pont clinicien (sans id interne). */
export function toQuestionnairesImagingDocument(
  doc: PatientDocument,
): QuestionnairesImagingDocument | null {
  if (doc.renderType === 'video') return null
  if (
    doc.renderType !== 'dicom' &&
    doc.renderType !== 'pdf' &&
    doc.renderType !== 'image' &&
    doc.renderType !== 'other'
  ) {
    return null
  }
  // 'other' exclu du portail clinicien (pas de carte utile).
  if (doc.renderType === 'other') return null

  return {
    fileName: doc.fileName,
    url: doc.url,
    renderType: doc.renderType,
    sizeBytes: doc.sizeBytes,
    sopInstanceUid: doc.sopInstanceUid,
    seriesInstanceUid: doc.seriesInstanceUid,
    seriesDescription: doc.seriesDescription,
    bodyPart: doc.bodyPart,
    instanceNumber: doc.instanceNumber,
    acquisitionDatetime: doc.acquisitionDatetime,
  }
}
