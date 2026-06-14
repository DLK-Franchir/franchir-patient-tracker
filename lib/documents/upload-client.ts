/**
 * ============================================================================
 * Orchestration de l'upload DIRECT navigateur → Supabase Storage (Item A).
 *
 * Flux (aucun octet ne transite par la fonction serverless Vercel) :
 *   1. POST /api/patients/{id}/documents/sign-upload → URLs signées d'upload ;
 *   2. pour chaque fichier, `uploadToSignedUrl(path, token, file)` DIRECT vers
 *      Storage avec le client navigateur (anon) ;
 *   3. POST /api/patients/{id}/documents/finalize → enregistre les métadonnées
 *      (et déclenche le forward best-effort vers le portail chirurgien).
 *
 * Le seul plafond restant est la taille par fichier (100 Mo) ; le nombre de
 * fichiers (séries / dossiers DICOM) n'est plus limité en pratique. Les URLs
 * signées sont demandées par sous-lots pour ne pas générer une requête géante.
 * ============================================================================
 */

import { createClient } from '@/lib/supabase/client'
import { PATIENT_DOCUMENTS_BUCKET } from '@/lib/documents/patient-documents'

/** Taille des sous-lots d'émission d'URLs signées (équilibre latence / charge). */
const SIGN_BATCH_SIZE = 50

/** Uploads parallèles simultanés (évite de saturer le réseau du navigateur). */
const UPLOAD_CONCURRENCY = 4

type SignedUpload = {
  fileName: string
  path: string
  token: string
  signedUrl: string
}

type FinalizeDocument = {
  path: string
  fileName: string
  size: number
  type: string | null
}

export type UploadProgress = {
  total: number
  uploaded: number
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
 * Uploade une liste de fichiers vers le dossier Storage du patient via des URLs
 * signées, puis enregistre les métadonnées. Lève une `Error` à message lisible
 * en cas d'échec (l'appelant affiche le message). `onProgress` est optionnel.
 */
export async function uploadPatientDocuments(
  patientId: string,
  files: File[],
  onProgress?: (progress: UploadProgress) => void,
): Promise<{ count: number }> {
  if (files.length === 0) return { count: 0 }

  const supabase = createClient()
  const finalized: FinalizeDocument[] = []
  let uploadedCount = 0

  for (const batch of chunk(files, SIGN_BATCH_SIZE)) {
    // 1. Demande les URLs signées pour ce sous-lot.
    const signRes = await fetch(`/api/patients/${patientId}/documents/sign-upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: batch.map((f) => ({ name: f.name, size: f.size, type: f.type || null })),
      }),
    })
    if (!signRes.ok) {
      throw new Error(await parseError(signRes, "Échec de la préparation de l'upload"))
    }
    const { uploads } = (await signRes.json()) as { uploads: SignedUpload[] }

    // Apparie chaque URL signée à son fichier (même ordre que la requête).
    const pairs = uploads.map((upload, index) => ({ upload, file: batch[index] }))

    // 2. Upload DIRECT vers Storage, avec une concurrence bornée.
    for (const group of chunk(pairs, UPLOAD_CONCURRENCY)) {
      await Promise.all(
        group.map(async ({ upload, file }) => {
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
          })
          uploadedCount += 1
          onProgress?.({ total: files.length, uploaded: uploadedCount })
        }),
      )
    }
  }

  // 3. Enregistre les métadonnées (route légère : aucun octet).
  const finalizeRes = await fetch(`/api/patients/${patientId}/documents/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documents: finalized }),
  })
  if (!finalizeRes.ok) {
    throw new Error(await parseError(finalizeRes, "Échec de l'enregistrement des fichiers"))
  }
  const data = (await finalizeRes.json()) as { count?: number }
  return { count: data.count ?? finalized.length }
}
