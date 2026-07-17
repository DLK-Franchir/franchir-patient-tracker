/**
 * Lecture de l'imagerie patient déposée via le questionnaire (bucket
 * `patient-images` côté app questionnaires — Item C). Fail-closed si le pont
 * n'est pas configuré.
 */

const BASE =
  process.env.QUESTIONNAIRES_API_BASE ||
  'https://questionnaire.franchir.eu/api/integrations/tracker'

export type QuestionnaireImagingFile = {
  name: string
  url: string
  type: 'image' | 'pdf' | 'dicom' | 'video'
  size?: number | null
  /** Métadonnées DICOM renvoyées par le pont patient-images (SeriesInstanceUID…). */
  seriesInstanceUid?: string | null
  seriesDescription?: string | null
  sopInstanceUid?: string | null
  instanceNumber?: number | null
}

export type FetchQuestionnaireImagingOptions = {
  /**
   * Range-header enrich côté Q (coûteux : N GETs). Défaut false — Marcel
   * déduplique via basename / SeriesInstanceUID déjà en base tracker ; le nom
   * Storage `SUID.*` suffit pour les uploads récents.
   */
  enrichMetadata?: boolean
}

export async function fetchQuestionnairePatientImages(
  trackerPatientId: string,
  options: FetchQuestionnaireImagingOptions = {},
): Promise<QuestionnaireImagingFile[] | null> {
  const token = process.env.TRACKER_SYNC_SERVICE_TOKEN
  if (!token) return null
  const enrichMetadata = options.enrichMetadata === true
  try {
    const qs = new URLSearchParams({
      trackerPatientId,
      enrichMetadata: enrichMetadata ? '1' : '0',
    })
    const res = await fetch(`${BASE}/patient-images?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
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
