/**
 * Accès au suivi questionnaire (app questionnaires) depuis le cockpit tracker.
 * Lecture du statut détaillé (lien actif + sessions longitudinales) et
 * révocation de lien, via les endpoints service-token. Fail-closed : si le
 * pont n'est pas configuré (`TRACKER_SYNC_SERVICE_TOKEN`), renvoie null/false
 * sans casser le rendu de la fiche.
 */

const BASE =
  process.env.QUESTIONNAIRES_API_BASE ||
  'https://franchir-questionnaires-patients.vercel.app/api/integrations/tracker'

export type QuestionnaireSessionSummary = {
  id: string
  label: string
  status: 'draft' | 'in_progress' | 'completed'
  createdAt: string
  completedAt: string | null
  isActive: boolean
}

export type QuestionnaireStatus = {
  activeLink: {
    status: string
    expiresAt: string
    sentAt: string | null
    openedAt: string | null
    completedAt: string | null
  } | null
  sessions: QuestionnaireSessionSummary[]
}

export async function fetchQuestionnaireStatus(
  trackerPatientId: string,
): Promise<QuestionnaireStatus | null> {
  const token = process.env.TRACKER_SYNC_SERVICE_TOKEN
  if (!token) return null
  try {
    const res = await fetch(
      `${BASE}/questionnaire-status?trackerPatientId=${encodeURIComponent(trackerPatientId)}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
    )
    if (!res.ok) return null
    return (await res.json()) as QuestionnaireStatus
  } catch {
    return null
  }
}

export async function revokeQuestionnaireLink(trackerPatientId: string): Promise<boolean> {
  const token = process.env.TRACKER_SYNC_SERVICE_TOKEN
  if (!token) return false
  try {
    const res = await fetch(`${BASE}/questionnaire-revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ trackerPatientId }),
    })
    return res.ok
  } catch {
    return false
  }
}
