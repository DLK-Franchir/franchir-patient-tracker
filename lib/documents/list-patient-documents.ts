import type { SupabaseClient } from '@supabase/supabase-js'
import {
  PATIENT_DOCUMENTS_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  MAX_DOCUMENTS_LISTED,
  inferRenderType,
  type DocumentKind,
  type PatientDocument,
} from '@/lib/documents/patient-documents'

/**
 * Listing serveur des fichiers d'un patient.
 *
 * Source de vérité : la table public.patient_documents (et non le listing brut
 * du dossier Storage). Pour chaque ligne, une URL signée courte est mintée en
 * un seul appel batch (évite le N+1). À n'appeler QUE depuis une route serveur
 * APRÈS vérification d'accès (staff). Ne jamais logguer noms/URLs.
 *
 * `supabase` doit être un client service-role (lecture table + mint d'URLs
 * signées sur le bucket privé).
 */
export async function listPatientDocuments(
  supabase: SupabaseClient,
  patientId: string,
): Promise<PatientDocument[]> {
  const { data: rows, error } = await supabase
    .from('patient_documents')
    .select('id, kind, file_path, file_name, mime_type, size_bytes, created_at')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: true })
    .limit(MAX_DOCUMENTS_LISTED)

  if (error) {
    console.error('[patient-documents] list failed', error.message)
    throw new Error('Failed to list patient documents')
  }

  const records = rows ?? []
  if (records.length === 0) return []

  const paths = records.map((r) => r.file_path as string)
  const { data: signedList, error: signError } = await supabase.storage
    .from(PATIENT_DOCUMENTS_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)

  if (signError) {
    console.error('[patient-documents] sign failed', signError.message)
    throw new Error('Failed to sign patient documents')
  }

  const files: PatientDocument[] = []
  for (let index = 0; index < records.length; index += 1) {
    const signed = signedList?.[index]
    if (!signed?.signedUrl) continue
    const row = records[index]
    files.push({
      id: row.id as string,
      kind: row.kind as DocumentKind,
      fileName: row.file_name as string,
      mimeType: (row.mime_type as string | null) ?? null,
      sizeBytes: (row.size_bytes as number | null) ?? null,
      createdAt: row.created_at as string,
      url: signed.signedUrl,
      renderType: inferRenderType(row.file_name as string, row.mime_type as string | null),
    })
  }

  return files
}
