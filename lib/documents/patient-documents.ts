import { z } from 'zod'

/**
 * Règles et helpers partagés pour les fichiers patients (DICOM + documents)
 * stockés DANS LE PROJET TRACKER (bucket privé `patient-documents`).
 *
 * Layout des objets : `patients/{patientId}/{timestamp}_{nom_securise}`
 * (aligné sur les policies storage de la migration
 * 20260613190100_patient_documents_storage_bucket.sql).
 *
 * Aucune dépendance au projet questionnaires : stockage et visualisation
 * restent 100 % côté tracker.
 */

export const PATIENT_DOCUMENTS_BUCKET = 'patient-documents'

/**
 * Taille max par fichier : 100 Mo. Les séries DICOM et scans haute résolution
 * peuvent être lourds. Depuis l'upload DIRECT navigateur → Storage (URLs signées),
 * les octets ne transitent plus par la fonction serverless (plus de limite
 * pratique de ~4,5 Mo par requête) : seule cette limite par fichier subsiste.
 */
export const MAX_DOCUMENT_FILE_SIZE = 100 * 1024 * 1024

/**
 * Plafond de fichiers par lot (un dossier DICOM = des centaines de coupes).
 * L'upload direct ne fait plus transiter les octets par la fonction : ce plafond
 * n'est qu'un garde-fou large contre un import accidentel massif. Le client
 * découpe l'émission des URLs signées en sous-lots.
 */
export const MAX_DOCUMENTS_PER_REQUEST = 1000

/** TTL des URLs signées (PHI) : court, régénéré à chaque affichage. */
/** TTL URLs signées imagerie — séries volumineuses JPEG-LS. */
export const SIGNED_URL_TTL_SECONDS = 1800

/** Plafond de fichiers listés par patient (séries DICOM CD = centaines de coupes). */
export const MAX_DOCUMENTS_LISTED = 2000

/**
 * Catégorie de stockage persistée dans patient_documents.kind :
 *  - 'dicom'    : imagerie DICOM (visionneuse dwv)
 *  - 'document' : PDF / image / autre document
 */
export type DocumentKind = 'dicom' | 'document'

/**
 * Type de rendu UI, plus fin que `kind` : déduit du nom/mime au moment de
 * l'affichage. 'dicom' → visionneuse dwv, 'pdf' → iframe, 'image' → <img>,
 * 'other' → téléchargement uniquement.
 */
export type DocumentRenderType = 'dicom' | 'pdf' | 'image' | 'other'

const DICOM_MIME_TYPES = new Set(['application/dicom', 'image/dicom'])
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif'])
const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
])

/**
 * Types/extensions acceptés. Le DICOM arrive souvent SANS content-type
 * exploitable : l'extension fait foi (cf. isAllowedDocumentFile).
 */
export const ALLOWED_DOCUMENT_MIME_TYPES = new Set<string>([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/dicom',
  'image/dicom',
])

export const ALLOWED_DOCUMENT_EXTENSIONS = new Set<string>([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'pdf',
  'dcm',
  'dicom',
])

/** Extension en minuscules sans le point, ou null. */
export function getFileExtension(name: string): string | null {
  const dotIndex = name.lastIndexOf('.')
  if (dotIndex < 0 || dotIndex === name.length - 1) {
    return null
  }
  return name.slice(dotIndex + 1).toLowerCase()
}

/**
 * Un fichier est accepté si SON content-type est dans l'allow-list OU si son
 * extension l'est (couvre le DICOM en octet-stream / sans type).
 */
export function isAllowedDocumentFile(name: string, type: string | null | undefined): boolean {
  const normalizedType = type?.toLowerCase().trim()
  if (normalizedType && ALLOWED_DOCUMENT_MIME_TYPES.has(normalizedType)) {
    return true
  }
  const ext = getFileExtension(name)
  if (ext !== null && ALLOWED_DOCUMENT_EXTENSIONS.has(ext)) {
    return true
  }
  // CD DICOM : fichiers sans extension, souvent en application/octet-stream.
  if (ext === null) {
    const t = normalizedType ?? ''
    if (t === '' || t === 'application/octet-stream') return true
  }
  return false
}

/**
 * Fichiers parasites couramment présents sur les CD/DVD d'imagerie médicale
 * (index DICOMDIR, visionneuses embarquées, autorun, vignettes système…). Lors
 * d'un import de DOSSIER (`webkitdirectory`), on les ignore SILENCIEUSEMENT :
 * ils ne sont ni de l'imagerie ni des documents cliniques et feraient échouer
 * la validation pour rien.
 */
const IGNORABLE_COMPANION_EXTENSIONS = new Set<string>([
  'exe',
  'bat',
  'cmd',
  'com',
  'dll',
  'ini',
  'inf',
  'sh',
  'app',
  'jar',
  'msi',
  'dmg',
  'so',
  'db',
  'lnk',
])

const IGNORABLE_COMPANION_BASENAMES = new Set<string>([
  'dicomdir',
  'autorun.inf',
  'autorun',
  'thumbs.db',
  '.ds_store',
  'desktop.ini',
  'readme',
  'readme.txt',
  'lisezmoi.txt',
])

/**
 * Vrai si le fichier est un parasite de CD/visionneuse à ignorer en silence
 * (pas une erreur de validation). Couvre DICOMDIR, exécutables/visionneuses et
 * fichiers système. Les fichiers cachés (`.qqch`) sont également ignorés.
 */
export function isIgnorableCompanionFile(name: string): boolean {
  const base = (name.split(/[\\/]/).pop() ?? name).trim().toLowerCase()
  if (base.length === 0) return true
  if (base.startsWith('.')) return true
  if (IGNORABLE_COMPANION_BASENAMES.has(base)) return true
  const ext = getFileExtension(base)
  return ext !== null && IGNORABLE_COMPANION_EXTENSIONS.has(ext)
}

/** Détermine le type de rendu UI d'un fichier depuis son nom et son mime. */
export function inferRenderType(name: string, mimeType?: string | null): DocumentRenderType {
  const normalizedMime = mimeType?.toLowerCase().trim()
  if (normalizedMime && DICOM_MIME_TYPES.has(normalizedMime)) return 'dicom'

  const ext = getFileExtension(name)
  if (ext === 'dcm' || ext === 'dicom') return 'dicom'
  // Sans extension + mime binaire → DICOM probable (CD médical).
  if (ext === null) {
    const t = normalizedMime ?? ''
    if (t === '' || t === 'application/octet-stream' || t === 'application/dicom' || t === 'image/dicom') {
      return 'dicom'
    }
  }
  if (ext === 'pdf' || normalizedMime === 'application/pdf') return 'pdf'
  if ((ext && IMAGE_EXTENSIONS.has(ext)) || (normalizedMime && IMAGE_MIME_TYPES.has(normalizedMime))) {
    return 'image'
  }
  return 'other'
}

/** Catégorie persistée (kind) : DICOM vs tout le reste (document). */
export function inferDocumentKind(name: string, mimeType?: string | null): DocumentKind {
  return inferRenderType(name, mimeType) === 'dicom' ? 'dicom' : 'document'
}

/**
 * Nettoie un nom de fichier (retire séparateurs de chemin et caractères
 * exotiques) pour l'intégrer sans risque dans une clé d'objet Storage.
 */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name
  const safe = base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200)
  return safe.length > 0 ? safe : 'fichier'
}

/**
 * Construit la clé Storage d'un fichier patient :
 * `patients/{patientId}/{timestamp}_{nom_securise}`.
 */
export function buildPatientDocumentObjectKey(
  patientId: string,
  filename: string,
  now: number = Date.now(),
): string {
  return `patients/${patientId}/${now}_${sanitizeFilename(filename)}`
}

/**
 * Garde anti-IDOR : la clé d'objet doit vivre DIRECTEMENT sous le dossier du
 * patient (`patients/{patientId}/`), jamais ailleurs ni en sous-dossier.
 */
export function isObjectKeyOwnedByPatient(objectKey: string, patientId: string): boolean {
  if (objectKey.includes('..')) {
    return false
  }
  const prefix = `patients/${patientId}/`
  if (!objectKey.startsWith(prefix)) {
    return false
  }
  const remainder = objectKey.slice(prefix.length)
  return remainder.length > 0 && !remainder.includes('/')
}

export type DocumentValidationError =
  | 'filename_required'
  | 'empty_file'
  | 'file_too_large'
  | 'unsupported_type'

const documentMetadataSchema = z.object({
  name: z.string().min(1, 'filename_required'),
  size: z.number().int().positive('empty_file').max(MAX_DOCUMENT_FILE_SIZE, 'file_too_large'),
  type: z.string().optional(),
})

/**
 * Validation complète d'un fichier (taille + type). Retourne la première règle
 * en échec, ou null si le fichier est acceptable.
 */
export function validateDocumentFile(file: {
  name: string
  size: number
  type?: string | null
}): DocumentValidationError | null {
  const parsed = documentMetadataSchema.safeParse({
    name: file.name,
    size: file.size,
    type: file.type ?? undefined,
  })
  if (!parsed.success) {
    const code = parsed.error.issues[0]?.message
    if (code === 'filename_required' || code === 'empty_file' || code === 'file_too_large') {
      return code
    }
    return 'file_too_large'
  }
  if (!isAllowedDocumentFile(file.name, file.type)) {
    return 'unsupported_type'
  }
  return null
}

export const DOCUMENT_VALIDATION_MESSAGES: Record<DocumentValidationError, string> = {
  filename_required: 'Nom de fichier manquant',
  empty_file: 'Fichier vide',
  file_too_large: 'Fichier trop volumineux (max 100 Mo)',
  unsupported_type: 'Type de fichier non pris en charge (DICOM, PDF ou image)',
}

/**
 * Métadonnée d'un fichier à enregistrer APRÈS un upload direct navigateur →
 * Storage (URL signée). La route de finalisation ne reçoit QUE ces métadonnées
 * (jamais les octets) : `path` est la clé Storage retournée par la signature,
 * re-validée serveur (anti-IDOR) avant l'INSERT dans patient_documents.
 */
export const finalizeDocumentSchema = z.object({
  path: z.string().min(1).max(500),
  fileName: z.string().min(1).max(255),
  size: z.number().int().nonnegative(),
  type: z.string().max(255).nullable().optional(),
})

export type FinalizeDocumentInput = z.infer<typeof finalizeDocumentSchema>

export const finalizeDocumentsRequestSchema = z.object({
  documents: z.array(finalizeDocumentSchema).min(1).max(MAX_DOCUMENTS_PER_REQUEST),
})

/** Métadonnées d'un document telles que renvoyées par l'API au navigateur. */
export type PatientDocument = {
  id: string
  kind: DocumentKind
  fileName: string
  mimeType: string | null
  sizeBytes: number | null
  createdAt: string
  /** URL signée courte (TTL ~5 min). */
  url: string
  /** Type de rendu UI déduit du nom/mime. */
  renderType: DocumentRenderType
}
