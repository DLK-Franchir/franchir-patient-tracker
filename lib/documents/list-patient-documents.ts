import type { SupabaseClient } from '@supabase/supabase-js'
import {
  PATIENT_DOCUMENTS_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  SIGNED_URL_BATCH_SIZE,
  inferRenderType,
  type DocumentKind,
  type PatientDocument,
} from '@/lib/documents/patient-documents'
import { fetchPatientDocumentRows } from '@/lib/documents/fetch-patient-document-rows'

export type ListPatientDocumentsResult = {
  documents: PatientDocument[]
  /** True si le dossier dépasse le plafond — seuls les fichiers les plus récents sont listés. */
  listingTruncated: boolean
}

type PatientDocumentRow = {
  id: string
  kind: string
  file_path: string
  file_name: string
  mime_type: string | null
  size_bytes: number | null
  created_at: string
  sop_instance_uid: string | null
  series_instance_uid: string | null
  modality: string | null
  series_description: string | null
  body_part: string | null
  instance_number: number | null
  acquisition_datetime: string | null
}

const LIST_SELECT =
  'id, kind, file_path, file_name, mime_type, size_bytes, created_at, sop_instance_uid, series_instance_uid, modality, series_description, body_part, instance_number, acquisition_datetime'

function chunkPaths(paths: string[], size: number): string[][] {
  const out: string[][] = []
  for (let i = 0; i < paths.length; i += size) {
    out.push(paths.slice(i, i + size))
  }
  return out
}

/**
 * Mint des URLs signées par lots. Retourne un tableau aligné sur `paths`
 * (null si échec individuel).
 */
async function signPathsBatched(
  supabase: SupabaseClient,
  paths: string[],
): Promise<(string | null)[]> {
  const signedUrls: (string | null)[] = []
  for (const batch of chunkPaths(paths, SIGNED_URL_BATCH_SIZE)) {
    const { data: signedList, error: signError } = await supabase.storage
      .from(PATIENT_DOCUMENTS_BUCKET)
      .createSignedUrls(batch, SIGNED_URL_TTL_SECONDS)

    if (signError) {
      console.error('[patient-documents] sign failed', signError.message)
      throw new Error('Failed to sign patient documents')
    }

    for (let index = 0; index < batch.length; index += 1) {
      const signed = signedList?.[index]
      signedUrls.push(signed?.signedUrl ?? null)
    }
  }
  return signedUrls
}

/**
 * Listing serveur des fichiers d'un patient.
 *
 * Source de vérité : la table public.patient_documents (et non le listing brut
 * du dossier Storage). Pour chaque ligne, une URL signée courte est mintée en
 * lots (évite le N+1 et les échecs partiels sur gros dossiers). À n'appeler
 * QUE depuis une route serveur APRÈS vérification d'accès (staff). Ne jamais
 * logguer noms/URLs.
 *
 * Ordre : plus récents d'abord (pages PostgREST), puis re-tri croissant pour
 * l'UI. Ainsi un nouvel upload n'est jamais coupé par le plafond au profit
 * d'anciennes séries. La pagination contourne `max_rows = 1000`.
 *
 * `supabase` doit être un client service-role (lecture table + mint d'URLs
 * signées sur le bucket privé).
 */
export async function listPatientDocuments(
  supabase: SupabaseClient,
  patientId: string,
): Promise<ListPatientDocumentsResult> {
  const { rows: records, truncated: listingTruncated } =
    await fetchPatientDocumentRows<PatientDocumentRow>(supabase, patientId, {
      select: LIST_SELECT,
    })

  if (records.length === 0) return { documents: [], listingTruncated: false }

  // Fenêtre = N plus récents ; re-tri ASC pour un affichage chronologique stable.
  records.sort((a, b) => {
    const aAt = a.created_at
    const bAt = b.created_at
    if (aAt === bAt) return String(a.id).localeCompare(String(b.id))
    return aAt < bAt ? -1 : 1
  })

  const paths = records.map((r) => r.file_path)
  const signedUrls = await signPathsBatched(supabase, paths)

  const documents: PatientDocument[] = []
  let unsignedCount = 0
  for (let index = 0; index < records.length; index += 1) {
    const signedUrl = signedUrls[index]
    if (!signedUrl) {
      unsignedCount += 1
      continue
    }
    const row = records[index]
    documents.push({
      id: row.id,
      kind: row.kind as DocumentKind,
      fileName: row.file_name,
      mimeType: row.mime_type ?? null,
      sizeBytes: row.size_bytes ?? null,
      createdAt: row.created_at,
      url: signedUrl,
      renderType: inferRenderType(row.file_name, row.mime_type),
      sopInstanceUid: row.sop_instance_uid ?? null,
      seriesInstanceUid: row.series_instance_uid ?? null,
      modality: row.modality ?? null,
      seriesDescription: row.series_description ?? null,
      bodyPart: row.body_part ?? null,
      instanceNumber: row.instance_number ?? null,
      acquisitionDatetime: row.acquisition_datetime ?? null,
    })
  }

  if (unsignedCount > 0) {
    // Compteur only — pas de chemins / noms (PHI).
    console.error('[patient-documents] unsigned files skipped', { unsignedCount })
  }

  return { documents, listingTruncated }
}
