/**
 * Pont tracker → questionnaires : téléchargement de la synthèse PDF
 * (validation médicale Gilles). Fail-closed si le token est absent.
 */

const BASE =
  process.env.QUESTIONNAIRES_API_BASE ||
  'https://questionnaire.franchir.eu/api/integrations/tracker'

export type QuestionnaireSynthesisPdfResult =
  | { ok: true; buffer: ArrayBuffer; filename: string }
  | { ok: false; status: 503 | 404 | 502; message: string }

export async function fetchQuestionnaireSynthesisPdf(
  trackerPatientId: string,
  sessionId?: string,
): Promise<QuestionnaireSynthesisPdfResult> {
  const token = process.env.TRACKER_SYNC_SERVICE_TOKEN
  if (!token) {
    return { ok: false, status: 503, message: 'Pont questionnaires non configuré' }
  }

  const params = new URLSearchParams({ trackerPatientId })
  if (sessionId) {
    params.set('sessionId', sessionId)
  }

  try {
    const res = await fetch(`${BASE}/patient-synthesis-pdf?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })

    if (res.status === 404) {
      return {
        ok: false,
        status: 404,
        message: 'Aucune synthèse disponible pour ce patient',
      }
    }

    if (!res.ok) {
      return {
        ok: false,
        status: res.status === 502 ? 502 : 503,
        message: 'Échec de la génération de la synthèse PDF',
      }
    }

    const disposition = res.headers.get('Content-Disposition') ?? ''
    const filenameMatch = disposition.match(/filename="([^"]+)"/)
    const filename = filenameMatch?.[1] ?? `franchir-synthese-${trackerPatientId.slice(0, 8)}.pdf`
    const buffer = await res.arrayBuffer()

    return { ok: true, buffer, filename }
  } catch {
    return { ok: false, status: 503, message: 'Pont questionnaires indisponible' }
  }
}
