/**
 * Upload vers une URL signée Supabase Storage (`createSignedUploadUrl`).
 *
 * Le protocole attendu est PUT + FormData (cacheControl + fichier), avec le
 * token dans la query string de `signedUrl` — PAS un header Authorization Bearer.
 * Aligné sur `@supabase/storage-js` `uploadToSignedUrl`.
 */

export type RemoteSignedUpload = {
  signedUrl: string
  path: string
  token: string
  fileName: string
}

/** PUT FormData vers l'URL signée ; retourne false si HTTP non-2xx. */
export async function putFileToSignedUploadUrl(
  upload: RemoteSignedUpload,
  body: Blob,
  contentType: string | null,
): Promise<boolean> {
  const formData = new FormData()
  formData.append('cacheControl', '3600')
  const file =
    body instanceof File
      ? body
      : new File([body], upload.fileName, {
          type: contentType && contentType.length > 0 ? contentType : 'application/octet-stream',
        })
  formData.append('', file)

  try {
    const response = await fetch(upload.signedUrl, {
      method: 'PUT',
      body: formData,
      headers: { 'x-upsert': 'false' },
    })
    return response.ok
  } catch {
    return false
  }
}
