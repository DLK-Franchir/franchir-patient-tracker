/**
 * Textes d'aide affichés près de la zone d'upload Marcel (délais, limites).
 * Dérivés des constantes applicatives — ne pas dupliquer les plafonds ailleurs.
 */
import {
  MAX_DOCUMENT_FILE_SIZE,
  MAX_DOCUMENTS_PER_REQUEST,
} from '@/lib/documents/patient-documents'
import { isMp4ViewerEnabled } from '@/lib/features/mp4-viewer'
import {
  MAX_POOL_LOAD_CONCURRENCY,
  MAX_SEQUENTIAL_POOL,
} from '@franchir/imaging-viewer'

/** Aligné lib/integrations/forward-imaging.ts SIGNED_FORWARD_MAX_FILE_SIZE */
export const FORWARD_TO_QUESTIONNAIRES_MAX_BYTES = 50 * 1024 * 1024

function mb(bytes: number): number {
  return Math.round(bytes / (1024 * 1024))
}

export const UPLOAD_LIMITS_MB = {
  maxFileSize: mb(MAX_DOCUMENT_FILE_SIZE),
  forwardMaxFileSize: mb(FORWARD_TO_QUESTIONNAIRES_MAX_BYTES),
  maxFilesPerBatch: MAX_DOCUMENTS_PER_REQUEST,
} as const

export const UPLOAD_GUIDANCE = {
  limitsSummary: `Taille max par fichier : ${UPLOAD_LIMITS_MB.maxFileSize} Mo. Formats : DICOM (.dcm), JPEG, PNG, PDF${isMp4ViewerEnabled() ? ', MP4' : ''}.`,
  batchLimit: `Jusqu'à ${MAX_DOCUMENTS_PER_REQUEST} fichiers par envoi (import CD complet possible).`,
  forwardNote: `Au-delà de ${UPLOAD_LIMITS_MB.forwardMaxFileSize} Mo par fichier, l'imagerie reste dans Marcel mais n'est pas transmise au portail chirurgien.`,
  cdImportDelay:
    "Import d'un CD DICOM : comptez 1 à 3 min pour l'analyse, puis plusieurs minutes pour l'envoi selon le volume. Ne fermez pas la page.",
  viewerDelay: `Dans la visionneuse, les séries volumineuses (p. ex. JPEG Lossless) peuvent prendre 30 à 60 s à s'afficher ; ${MAX_SEQUENTIAL_POOL} coupes max sont préchargées (${MAX_POOL_LOAD_CONCURRENCY} en parallèle).`,
  uploadingNote:
    'Envoi en cours — patientez sans fermer la page. Les gros dossiers DICOM peuvent prendre plusieurs minutes.',
  folderAnalyzingNote: "Analyse du dossier en cours — ne fermez pas la page.",
} as const

export function uploadGuidanceLines(): readonly string[] {
  return [
    UPLOAD_GUIDANCE.limitsSummary,
    UPLOAD_GUIDANCE.batchLimit,
    UPLOAD_GUIDANCE.forwardNote,
    UPLOAD_GUIDANCE.cdImportDelay,
    UPLOAD_GUIDANCE.viewerDelay,
  ]
}

export function dropzoneHintLine(): string {
  const formats = isMp4ViewerEnabled()
    ? 'Imagerie DICOM (.dcm) · PDF · images (JPG, PNG…) · MP4'
    : 'Imagerie DICOM (.dcm) · PDF · images (JPG, PNG…)'
  return `${formats} — ${UPLOAD_LIMITS_MB.maxFileSize} Mo max par fichier`
}
