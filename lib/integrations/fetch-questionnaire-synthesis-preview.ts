/**
 * Pont tracker → questionnaires : apercu JSON synthese Anamneze.
 * Fail-closed si le token est absent.
 */

import type { QuestionnaireSynthesisPreview } from '@/lib/integrations/questionnaire-synthesis-preview.types'

const BASE =
  process.env.QUESTIONNAIRES_API_BASE ||
  'https://questionnaire.franchir.eu/api/integrations/tracker'

export type QuestionnaireSynthesisPreviewResult =
  | { ok: true; preview: QuestionnaireSynthesisPreview }
  | { ok: false; status: 503 | 404 | 502; message: string }

export async function fetchQuestionnaireSynthesisPreview(
  trackerPatientId: string,
  sessionId?: string,
): Promise<QuestionnaireSynthesisPreviewResult> {
  const token = process.env.TRACKER_SYNC_SERVICE_TOKEN
  if (!token) {
    return { ok: false, status: 503, message: 'Pont questionnaires non configure' }
  }

  const params = new URLSearchParams({ trackerPatientId })
  if (sessionId) {
    params.set('sessionId', sessionId)
  }

  try {
    const res = await fetch(`${BASE}/patient-synthesis-preview?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })

    if (res.status === 404) {
      return {
        ok: false,
        status: 404,
        message: 'Aucune synthese disponible pour ce patient',
      }
    }

    if (!res.ok) {
      return {
        ok: false,
        status: res.status === 502 ? 502 : 503,
        message: 'Echec du chargement de la synthese',
      }
    }

    const preview = (await res.json()) as QuestionnaireSynthesisPreview
    return { ok: true, preview }
  } catch {
    return { ok: false, status: 503, message: 'Pont questionnaires indisponible' }
  }
}
