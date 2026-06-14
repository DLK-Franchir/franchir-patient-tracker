/**
 * Lecture de l'imagerie patient déposée via le questionnaire (bucket
 * `patient-images` côté app questionnaires — Item C). Fail-closed si le pont
 * n'est pas configuré.
 */

const BASE =
  process.env.QUESTIONNAIRES_API_BASE ||
  'https://franchir-questionnaires-patients.vercel.app/api/integrations/tracker'

export type QuestionnaireImagingFile = {
  name: string
  url: string
  type: 'image' | 'pdf' | 'dicom'
  size?: number | null
}

export async function fetchQuestionnairePatientImages(
  trackerPatientId: string,
): Promise<QuestionnaireImagingFile[] | null> {
  const token = process.env.TRACKER_SYNC_SERVICE_TOKEN
  if (!token) return null
  try {
    const res = await fetch(
      `${BASE}/patient-images?trackerPatientId=${encodeURIComponent(trackerPatientId)}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
    )
    if (!res.ok) return null
    const data = (await res.json()) as { files?: QuestionnaireImagingFile[] }
    return data.files ?? []
  } catch {
    return null
  }
}

export async function signQuestionnaireImagingUpload(
  trackerPatientId: string,
  files: Array<{ name: string; size: number; type: string | null }>,
): Promise<
  | {
      patientId: string
      uploads: Array<{ fileName: string; path: string; token: string; signedUrl: string }>
    }
  | null
> {
  const token = process.env.TRACKER_SYNC_SERVICE_TOKEN
  const url =
    process.env.QUESTIONNAIRES_IMAGING_SIGN_URL ||
    `${BASE}/imaging-sign-upload`
  if (!token) return null
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ trackerPatientId, files }),
    })
    if (!res.ok) return null
    return (await res.json()) as {
      patientId: string
      uploads: Array<{ fileName: string; path: string; token: string; signedUrl: string }>
    }
  } catch {
    return null
  }
}
