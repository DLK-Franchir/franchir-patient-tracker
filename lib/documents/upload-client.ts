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
import { inferRenderType, PATIENT_DOCUMENTS_BUCKET } from '@/lib/documents/patient-documents'
import { putFileToSignedUploadUrl } from '@/lib/integrations/signed-upload-put'
import {
  prepareDicomFilesForUpload,
  type PreparedUploadFile,
} from '@/lib/documents/prepare-dicom-for-upload'
import type { DicomPersistedMetadata } from '@/lib/imaging/dicom-content'
import { IMAGING_SANDBOX_PATIENT_ID } from '@/lib/access-control'

/** Taille des sous-lots d'émission d'URLs signées + finalize (évite un JSON géant). */
const SIGN_BATCH_SIZE = 20

/** Uploads parallèles : 4 saturait souvent le navigateur et bloquait le lot. */
const UPLOAD_CONCURRENCY = 2

const UPLOAD_TIMEOUT_MS = 90_000

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
  phase: 'prepare' | 'upload' | 'finalize'
  batch?: number
  batchCount?: number
  failed?: number
}

export type UploadResultSummary = {
  count: number
  skipped: number
  failed: number
}

/** Au-delà, les JPEG/PDF du viewer CD sont traités comme du bruit, pas un envoi mixte voulu. */
const CD_PREVIEW_JUNK_THRESHOLD = 20

/**
 * Un CD DICOM embarque souvent des milliers d'aperçus JPEG en plus des coupes.
 * Les envoyer avec les images tue l'onglet (~2 Go). On ne garde alors que le DICOM.
 */
export function selectFilesForPatientUpload(files: File[]): File[] {
  const dicomOnly = files.filter((file) => inferRenderType(file.name, file.type) === 'dicom')
  if (dicomOnly.length > 0 && files.length - dicomOnly.length >= CD_PREVIEW_JUNK_THRESHOLD) {
    return dicomOnly
  }
  return files
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size))
  }
  return out
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      reject(new Error(`${label} : délai dépassé (${Math.round(ms / 1000)} s)`))
    }, ms)
    promise.then(
      (value) => {
        globalThis.clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        globalThis.clearTimeout(timer)
        reject(error)
      },
    )
  })
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0
  const run = async () => {
    while (next < items.length) {
      const index = next
      next += 1
      const item = items[index]
      if (!item) continue
      await worker(item)
    }
  }
  const pool = Math.max(1, Math.min(concurrency, items.length))
  await Promise.all(Array.from({ length: pool }, () => run()))
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

async function finalizeDocuments(
  patientId: string,
  documents: FinalizeDocument[],
): Promise<{ count: number; skipped: number }> {
  const finalizeRes = await fetch(`/api/patients/${patientId}/documents/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documents }),
  })
  if (!finalizeRes.ok) {
    throw new Error(await parseError(finalizeRes, "Échec de l'enregistrement des fichiers"))
  }
  const data = (await finalizeRes.json()) as { count?: number; skipped?: number }
  return {
    count: data.count ?? documents.length,
    skipped: data.skipped ?? 0,
  }
}

/**
 * Uploade une liste de fichiers vers le dossier Storage du patient via des URLs
 * signées, puis enregistre les métadonnées. Lève une `Error` à message lisible
 * en cas d'échec (l'appelant affiche le message). `onProgress` est optionnel.
 *
 * Chaque sous-lot est finalisé tout de suite : si l'onglet plante à 200 / 3784,
 * les fichiers déjà envoyés restent dans le dossier.
 */
export async function uploadPatientDocuments(
  patientId: string,
  files: File[],
  onProgress?: (progress: UploadProgress) => void,
): Promise<UploadResultSummary> {
  if (files.length === 0) return { count: 0, skipped: 0, failed: 0 }

  const uploadFiles = selectFilesForPatientUpload(files)

  const supabase = createClient()
  let processedCount = 0
  let skippedDuplicates = 0
  let savedCount = 0
  let failedCount = 0
  const skipForward = patientId === IMAGING_SANDBOX_PATIENT_ID

  onProgress?.({ total: uploadFiles.length, uploaded: 0, phase: 'prepare' })
  const preparedAll = await prepareDicomFilesForUpload(uploadFiles, (done, total) => {
    onProgress?.({ total, uploaded: done, phase: 'prepare' })
  })

  const batches = chunk(preparedAll, SIGN_BATCH_SIZE)
  const batchCount = batches.length

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
    const batch = batches[batchIndex]!
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
        onProgress?.({
          total: uploadFiles.length,
          uploaded: processedCount,
          phase: 'upload',
          batch: batchIndex + 1,
          batchCount,
          failed: failedCount,
        })
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

    const batchFinalized: FinalizeDocument[] = []

    await mapPool(signedPairs, UPLOAD_CONCURRENCY, async ({ upload, prepared }) => {
      const { file, dicom } = prepared
      try {
        const { error } = await withTimeout(
          supabase.storage.from(PATIENT_DOCUMENTS_BUCKET).uploadToSignedUrl(upload.path, upload.token, file, {
            contentType: file.type || 'application/octet-stream',
          }),
          UPLOAD_TIMEOUT_MS,
          file.name,
        )
        if (error) {
          throw new Error(error.message)
        }
        batchFinalized.push({
          path: upload.path,
          fileName: file.name,
          size: file.size,
          type: file.type || null,
          dicom,
        })
      } catch {
        failedCount += 1
      }
      processedCount += 1
      onProgress?.({
        total: uploadFiles.length,
        uploaded: processedCount,
        phase: 'upload',
        batch: batchIndex + 1,
        batchCount,
        failed: failedCount,
      })
    })

    if (batchFinalized.length > 0) {
      onProgress?.({
        total: uploadFiles.length,
        uploaded: processedCount,
        phase: 'finalize',
        batch: batchIndex + 1,
        batchCount,
        failed: failedCount,
      })
      const finalized = await finalizeDocuments(patientId, batchFinalized)
      savedCount += finalized.count
      skippedDuplicates += finalized.skipped
    }

    if (!skipForward) {
      const acceptedFiles = batchFinalized.map((doc) => {
        const pair = signedPairs.find((item) => item.upload.path === doc.path)
        return pair?.prepared.file
      }).filter((file): file is File => Boolean(file))
      for (const qBatch of chunk(acceptedFiles, QUESTIONNAIRES_SIGN_BATCH_SIZE)) {
        await forwardBatchToQuestionnaires(patientId, qBatch)
      }
    }
  }

  if (savedCount === 0 && skippedDuplicates === 0) {
    throw new Error(
      failedCount > 0
        ? `Aucun fichier enregistré (${failedCount} échec(s) d'envoi). Réessayez sans fermer la page.`
        : "Aucun fichier enregistré.",
    )
  }

  return {
    count: savedCount,
    skipped: skippedDuplicates,
    failed: failedCount,
  }
}
