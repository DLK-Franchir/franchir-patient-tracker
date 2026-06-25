/**
 * Émission du lien questionnaire via le pont questionnaires (source de vérité).
 * Partagé entre POST /api/patients (envoi auto à la création) et
 * POST /api/patients/[id]/questionnaire-link (renvoi manuel).
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { syncPatientToQuestionnaires } from '@/lib/integrations/questionnaire-portal'
import { Logger } from '@/lib/logger'

const log = new Logger('integrations/issue-questionnaire-link')

const QUESTIONNAIRE_LINK_URL = `${
  process.env.QUESTIONNAIRES_API_BASE ||
  'https://questionnaire.franchir.eu/api/integrations/tracker'
}/questionnaire-link`

export type IssueQuestionnaireLinkResult =
  | {
      ok: true
      emailSent: boolean
      expiresAt: string | null
    }
  | {
      ok: false
      httpStatus: number
      error: string
      code?: 'bridge_not_configured' | 'sync_failed' | 'not_correlated' | 'completed' | 'upstream'
    }

export type IssueQuestionnaireLinkOptions = {
  patientId: string
  newSession?: boolean
  /** Met à jour questionnaire_language avant sync (renvoi manuel). */
  language?: 'fr' | 'en' | null
}

export async function issueQuestionnaireLink(
  options: IssueQuestionnaireLinkOptions,
): Promise<IssueQuestionnaireLinkResult> {
  const { patientId, newSession = false, language = null } = options
  const token = process.env.TRACKER_SYNC_SERVICE_TOKEN
  if (!token) {
    return {
      ok: false,
      httpStatus: 503,
      error: 'Pont questionnaires non configuré (TRACKER_SYNC_SERVICE_TOKEN absent)',
      code: 'bridge_not_configured',
    }
  }

  const service = createServiceRoleClient()
  const { data: existing } = await service
    .from('patients')
    .select('questionnaire_status')
    .eq('id', patientId)
    .maybeSingle()

  if (existing?.questionnaire_status === 'completed') {
    return {
      ok: false,
      httpStatus: 409,
      error:
        'Questionnaire déjà complété — pour une nouvelle évaluation, créez un nouveau dossier patient.',
      code: 'completed',
    }
  }

  if (language) {
    const { error: langError } = await service
      .from('patients')
      .update({ questionnaire_language: language })
      .eq('id', patientId)
    if (langError) {
      log.error('Mise a jour langue questionnaire echouee', { patientId, langError })
      return {
        ok: false,
        httpStatus: 502,
        error: 'Erreur mise a jour langue questionnaire',
        code: 'upstream',
      }
    }
  }

  const preSynced = await syncPatientToQuestionnaires(patientId)
  if (!preSynced) {
    log.error('Pre-sync questionnaires echouee avant emission lien', { patientId })
    return {
      ok: false,
      httpStatus: 502,
      error:
        'Synchronisation du dossier vers le portail questionnaire impossible. Reessayez dans un instant.',
      code: 'sync_failed',
    }
  }

  let response = await fetch(QUESTIONNAIRE_LINK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ trackerPatientId: patientId, newSession }),
  })

  if (response.status === 404) {
    log.warn('Dossier non corrélé — tentative de sync rattrapage', { patientId })
    const synced = await syncPatientToQuestionnaires(patientId)
    if (synced) {
      response = await fetch(QUESTIONNAIRE_LINK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ trackerPatientId: patientId, newSession }),
      })
    }
  }

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}))
    if (response.status === 404) {
      return {
        ok: false,
        httpStatus: 409,
        error:
          "Le dossier n'est pas encore synchronisé côté questionnaires. Réessayez dans un instant.",
        code: 'not_correlated',
      }
    }
    if (response.status === 409) {
      return {
        ok: false,
        httpStatus: 409,
        error:
          'Questionnaire déjà complété — pour une nouvelle évaluation, créez un nouveau dossier patient.',
        code: 'completed',
      }
    }
    log.error('Émission lien questionnaire échouée', { status: response.status, detail })
    const upstreamCode = typeof detail?.error === 'string' ? detail.error : 'inconnu'
    return {
      ok: false,
      httpStatus: 502,
      error: `Échec émission lien (questionnaires ${response.status} : ${upstreamCode})`,
      code: 'upstream',
    }
  }

  const result = (await response.json()) as { emailSent?: boolean; expiresAt?: string | null }
  const emailSent = result.emailSent ?? false

  await markQuestionnaireLinkIssued(patientId, emailSent)

  return {
    ok: true,
    emailSent,
    expiresAt: result.expiresAt ?? null,
  }
}

/** `sent` uniquement si l'email patient a bien été expédié (Resend côté questionnaires). */
export async function markQuestionnaireLinkIssued(
  patientId: string,
  emailSent: boolean,
): Promise<void> {
  if (!emailSent) return

  const service = createServiceRoleClient()
  const { data: current } = await service
    .from('patients')
    .select('questionnaire_status')
    .eq('id', patientId)
    .maybeSingle()

  if (current?.questionnaire_status !== 'completed') {
    await service.from('patients').update({ questionnaire_status: 'sent' }).eq('id', patientId)
  }
}

/**
 * Corrige un état tracker `sent` alors que le portail n'a jamais confirmé l'envoi email.
 */
export async function reconcileQuestionnaireSentStatus(
  trackerPatientId: string,
  portalSentAt: string | null | undefined,
  currentTrackerStatus: string | null | undefined,
): Promise<boolean> {
  if (currentTrackerStatus !== 'sent' || portalSentAt) return false

  const service = createServiceRoleClient()
  const { error } = await service
    .from('patients')
    .update({ questionnaire_status: null })
    .eq('id', trackerPatientId)
    .eq('questionnaire_status', 'sent')

  return !error
}
