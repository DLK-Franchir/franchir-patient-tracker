/**
 * ============================================================================
 * Orchestration de l'upload DIRECT navigateur → Supabase Storage (Item A).
 *
 * Flux (aucun octet ne transite par la fonction serverless Vercel) :
 *   1. Prépare DICOM (métadonnées + nom SUID.*) côté navigateur ;
 *   2. POST /api/patients/{id}/documents/sign-upload → URLs signées d'upload ;
 *   3. pour chaque fichier, `uploadToSignedUrl(path, token, file)` DIRECT vers
 *      Storage avec le client navigateur (anon) ;
 *   4. POST /api/patients/{id}/documents/finalize → enregistre les métadonnées
 *      (et déclenche le forward best-effort vers le portail chirurgien).
 *
 * Le seul plafond restant est la taille par fichier (100 Mo) ; le nombre de
 * fichiers (séries / dossiers DICOM) n'est plus limité en pratique. Les URLs
 * signées sont demandées par sous-lots pour ne pas générer une requête géante.
 * ============================================================================
 */

import { createClient } from '@/lib/supabase/client'
import { PATIENT_DOCUMENTS_BUCKET } from '@/lib/documents/patient-documents'
import { putFileToSignedUploadUrl } from '@/lib/integrations/signed-upload-put'
import {
  prepareDicomFilesForUpload,
  type PreparedUploadFile,
} from '@/lib/documents/prepare-dicom-for-upload'
import type { DicomPersistedMetadata } from '@/lib/imaging/dicom-content'

/** Taille des sous-lots d'émission d'URLs signées (équilibre latence / charge). */
const SIGN_BATCH_SIZE = 50

/** Uploads parallèles simultanés (évite de saturer le réseau du navigateur). */
const UPLOAD_CONCURRENCY = 4

/** Aligné sur MAX_IMAGING_FILES côté portail questionnaires (10). */
const QUESTIONNAIRES_SIGN_BATCH_SIZE = 10

type SignedUpload = {
  fileName: string
  path: string
  token: string
  signedUrl: string
}

type SignUploadResult =
  | { status: 'signed'; fileName: string; path: string; token: string; signedUrl: string }
  | { status: 'skipped'; fileName: string; reason: 'duplicate' }

type FinalizeDocument = {
  path: string
  fileName: string
  size: number
  type: string | null
  dicom: DicomPersistedMetadata | null
}

export type UploadProgress = {
  total: number
  uploaded: number
}

export type UploadResultSummary = {
  count: number
  skipped: number
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size))
  }
  return out
}

async function parseError(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => ({}))
  return (data as { error?: string }).error || fallback
}

/**
 * Pousse les mêmes octets vers le bucket patient-images du portail questionnaires
 * via URLs signées (protocole Supabase FormData PUT). Retourne le nombre de
 * fichiers forwardés avec succès.
 */
async function forwardBatchToQuestionnaires(
  patientId: string,
  batch: File[],
): Promise<number> {
  const signRes = await fetch(`/api/patients/${patientId}/questionnaires-imaging/sign-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      files: batch.map((f) => ({ name: f.name, size: f.size, type: f.type || null })),
    }),
  })
  if (!signRes.ok) {
    console.warn('[upload-client] forward sign-upload failed', signRes.status)
    return 0
  }

  const { uploads } = (await signRes.json()) as { uploads?: SignedUpload[] }
  if (!uploads?.length) return 0

  let forwarded = 0
  const pairs = uploads
    .map((upload, index) => ({ upload, file: batch[index] }))
    .filter((p): p is { upload: SignedUpload; file: File } => Boolean(p.file))

  for (const group of chunk(pairs, UPLOAD_CONCURRENCY)) {
    const results = await Promise.all(
      group.map(async ({ upload, file }) => {
        const ok = await putFileToSignedUploadUrl(
          { ...upload, fileName: file.name },
          file,
          file.type || null,
        )
        if (!ok) {
          // Un retry immédiat compense les courses réseau transitoires.
          return putFileToSignedUploadUrl(
            { ...upload, fileName: file.name },
            file,
            file.type || null,
          )
        }
        return ok
      }),
    )
    forwarded += results.filter(Boolean).length
  }

  if (forwarded < batch.length) {
    console.warn(
      `[upload-client] forward partiel questionnaires: ${forwarded}/${batch.length} fichiers`,
    )
  }
  return forwarded
}

/**
 * Uploade une liste de fichiers vers le dossier Storage du patient via des URLs
 * signées, puis enregistre les métadonnées. Lève une `Error` à message lisible
 * en cas d'échec (l'appelant affiche le message). `onProgress` est optionnel.
 */
export async function uploadPatientDocuments(
  patientId: string,
  files: File[],
  onProgress?: (progress: UploadProgress) => void,
): Promise<UploadResultSummary> {
  if (files.length === 0) return { count: 0, skipped: 0 }

  const supabase = createClient()
  const finalized: FinalizeDocument[] = []
  let processedCount = 0
  let skippedDuplicates = 0

  // P3b : métadonnées + nom SUID.* avant sign/upload (tous chemins, pas seulement dossier).
  const preparedAll = await prepareDicomFilesForUpload(files)

  for (const batch of chunk(preparedAll, SIGN_BATCH_SIZE)) {
    const signRes = await fetch(`/api/patients/${patientId}/documents/sign-upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: batch.map((p: PreparedUploadFile) => ({
          name: p.file.name,
          size: p.file.size,
          type: p.file.type || null,
          sopInstanceUid: p.dicom?.sopInstanceUid ?? null,
        })),
      }),
    })
    if (!signRes.ok) {
      throw new Error(await parseError(signRes, "Échec de la préparation de l'upload"))
    }
    const { results } = (await signRes.json()) as { results: SignUploadResult[] }

    const signedPairs: Array<{
      upload: SignedUpload
      prepared: PreparedUploadFile
    }> = []
    for (let index = 0; index < results.length; index += 1) {
      const result = results[index]
      const prepared = batch[index]
      if (!result || !prepared) continue
      if (result.status === 'skipped') {
        skippedDuplicates += 1
        processedCount += 1
        onProgress?.({ total: files.length, uploaded: processedCount })
        continue
      }
      signedPairs.push({
        upload: {
          fileName: result.fileName,
          path: result.path,
          token: result.token,
          signedUrl: result.signedUrl,
        },
        prepared,
      })
    }

    for (const group of chunk(signedPairs, UPLOAD_CONCURRENCY)) {
      await Promise.all(
        group.map(async ({ upload, prepared }) => {
          const { file, dicom } = prepared
          const { error } = await supabase.storage
            .from(PATIENT_DOCUMENTS_BUCKET)
            .uploadToSignedUrl(upload.path, upload.token, file, {
              contentType: file.type || 'application/octet-stream',
            })
          if (error) {
            throw new Error(`${file.name} : ${error.message}`)
          }
          finalized.push({
            path: upload.path,
            fileName: file.name,
            size: file.size,
            type: file.type || null,
            dicom,
          })
          processedCount += 1
          onProgress?.({ total: files.length, uploaded: processedCount })
        }),
      )
    }

    const acceptedFiles = signedPairs.map((p) => p.prepared.file)
    for (const qBatch of chunk(acceptedFiles, QUESTIONNAIRES_SIGN_BATCH_SIZE)) {
      await forwardBatchToQuestionnaires(patientId, qBatch)
    }
  }

  if (finalized.length === 0) {
    return { count: 0, skipped: skippedDuplicates }
  }

  const finalizeRes = await fetch(`/api/patients/${patientId}/documents/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documents: finalized }),
  })
  if (!finalizeRes.ok) {
    throw new Error(await parseError(finalizeRes, "Échec de l'enregistrement des fichiers"))
  }
  const data = (await finalizeRes.json()) as { count?: number; skipped?: number }
  return {
    count: data.count ?? finalized.length,
    skipped: skippedDuplicates + (data.skipped ?? 0),
  }
}
