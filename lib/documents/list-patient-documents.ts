import type { SupabaseClient } from '@supabase/supabase-js'
import {
  PATIENT_DOCUMENTS_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  MAX_DOCUMENTS_LISTED,
  inferRenderType,
  type DocumentKind,
  type PatientDocument,
} from '@/lib/documents/patient-documents'

export type ListPatientDocumentsResult = {
  documents: PatientDocument[]
  /** True si le dossier dépasse le plafond — seuls les fichiers les plus récents sont listés. */
  listingTruncated: boolean
}

/**
 * Listing serveur des fichiers d'un patient.
 *
 * Source de vérité : la table public.patient_documents (et non le listing brut
 * du dossier Storage). Pour chaque ligne, une URL signée courte est mintée en
 * un seul appel batch (évite le N+1). À n'appeler QUE depuis une route serveur
 * APRÈS vérification d'accès (staff). Ne jamais logguer noms/URLs.
 *
 * Ordre : plus récents d'abord, puis re-tri croissant pour l'UI. Ainsi un nouvel
 * upload n'est jamais coupé par le plafond au profit d'anciennes séries.
 *
 * `supabase` doit être un client service-role (lecture table + mint d'URLs
 * signées sur le bucket privé).
 */
export async function listPatientDocuments(
  supabase: SupabaseClient,
  patientId: string,
): Promise<ListPatientDocumentsResult> {
  const { data: rows, error } = await supabase
    .from('patient_documents')
    .select(
      'id, kind, file_path, file_name, mime_type, size_bytes, created_at, sop_instance_uid, series_instance_uid, modality, series_description, body_part, instance_number, acquisition_datetime',
    )
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(MAX_DOCUMENTS_LISTED)

  if (error) {
    console.error('[patient-documents] list failed', error.message)
    throw new Error('Failed to list patient documents')
  }

  const records = rows ?? []
  const listingTruncated = records.length >= MAX_DOCUMENTS_LISTED
  if (records.length === 0) return { documents: [], listingTruncated: false }

  // Fenêtre = N plus récents ; re-tri ASC pour un affichage chronologique stable.
  records.sort((a, b) => {
    const aAt = a.created_at as string
    const bAt = b.created_at as string
    if (aAt === bAt) return String(a.id).localeCompare(String(b.id))
    return aAt < bAt ? -1 : 1
  })

  const paths = records.map((r) => r.file_path as string)
  const { data: signedList, error: signError } = await supabase.storage
    .from(PATIENT_DOCUMENTS_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)

  if (signError) {
    console.error('[patient-documents] sign failed', signError.message)
    throw new Error('Failed to sign patient documents')
  }

  const documents: PatientDocument[] = []
  for (let index = 0; index < records.length; index += 1) {
    const signed = signedList?.[index]
    if (!signed?.signedUrl) continue
    const row = records[index]
    documents.push({
      id: row.id as string,
      kind: row.kind as DocumentKind,
      fileName: row.file_name as string,
      mimeType: (row.mime_type as string | null) ?? null,
      sizeBytes: (row.size_bytes as number | null) ?? null,
      createdAt: row.created_at as string,
      url: signed.signedUrl,
      renderType: inferRenderType(row.file_name as string, row.mime_type as string | null),
      sopInstanceUid: (row.sop_instance_uid as string | null) ?? null,
      seriesInstanceUid: (row.series_instance_uid as string | null) ?? null,
      modality: (row.modality as string | null) ?? null,
      seriesDescription: (row.series_description as string | null) ?? null,
      bodyPart: (row.body_part as string | null) ?? null,
      instanceNumber: (row.instance_number as number | null) ?? null,
      acquisitionDatetime: (row.acquisition_datetime as string | null) ?? null,
    })
  }

  return { documents, listingTruncated }
}
