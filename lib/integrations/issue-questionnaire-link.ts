/**
 * Émission du lien questionnaire via le pont questionnaires (source de vérité).
 * Utilisé par POST /api/patients/[id]/questionnaire-link (dispatch staff).
 * Par défaut : sendEmail=false (Marcel copie / mailto) ; legacy Resend si le
 * portail renvoie emailSent sans url.
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { syncPatientToQuestionnaires } from '@/lib/integrations/questionnaire-portal'
import {
  type QuestionnaireFormType,
  coercePatientFormTypes,
  formTypesEqual,
  normalizeFormTypes,
} from '@/lib/integrations/questionnaire-form-types'
import type { QuestionnaireEmailDraft } from '@/lib/integrations/questionnaire-email-draft'
import { Logger } from '@/lib/logger'

const log = new Logger('integrations/issue-questionnaire-link')

const QUESTIONNAIRE_LINK_URL = `${
  process.env.QUESTIONNAIRES_API_BASE ||
  'https://questionnaire.franchir.eu/api/integrations/tracker'
}/questionnaire-link`

/** Timeout M2M pont questionnaires (Fluid Compute, défaut Vercel 300 s). */
export const QUESTIONNAIRE_BRIDGE_FETCH_TIMEOUT_MS = 30_000

/** Corps M2M POST /api/integrations/tracker/questionnaire-link */
export type QuestionnaireBridgeBody = {
  trackerPatientId: string
  newSession?: boolean
  patientEmail?: string
  sessionLabel?: string | null
  ttlHours?: number
  /** false = émettre le lien sans Resend (dispatch staff). Défaut tracker : false. */
  sendEmail?: boolean
}

export async function postQuestionnaireBridge(
  body: QuestionnaireBridgeBody,
  token: string,
): Promise<Response> {
  return fetch(QUESTIONNAIRE_LINK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(QUESTIONNAIRE_BRIDGE_FETCH_TIMEOUT_MS),
  })
}

async function postQuestionnaireBridgeSafe(
  body: QuestionnaireBridgeBody,
  token: string,
): Promise<Response | null> {
  try {
    return await postQuestionnaireBridge(body, token)
  } catch (err) {
    log.error('Pont questionnaires injoignable', { err })
    return null
  }
}

export type IssueQuestionnaireLinkResult =
  | {
      ok: true
      emailSent: boolean
      expiresAt: string | null
      /** Lien magique patient — uniquement si le pont le renvoie (sendEmail=false). */
      url: string | null
      /** Brouillon email pont (optionnel) ; sinon fallback tracker. */
      emailDraft: QuestionnaireEmailDraft | null
      /** True si une nouvelle session a été demandée (y compris forcée par changement de pathologie). */
      effectiveNewSession: boolean
      /** Mode staff (url) vs legacy Resend auto. */
      dispatchMode: 'staff' | 'legacy_resend'
    }
  | {
      ok: false
      httpStatus: number
      error: string
      code?: 'bridge_not_configured' | 'sync_failed' | 'not_correlated' | 'completed' | 'upstream' | 'url_missing'
    }

export type IssueQuestionnaireLinkOptions = {
  patientId: string
  newSession?: boolean
  /** Met à jour questionnaire_language avant sync (renvoi manuel). */
  language?: 'fr' | 'en' | null
  /** Met à jour patients.form_types avant sync + émission (fiche patient). */
  formTypes?: QuestionnaireFormType[] | null
  /**
   * false (défaut) : demander le lien sans Resend pour dispatch staff.
   * true : forcer l’envoi Resend legacy côté questionnaires.
   */
  sendEmail?: boolean
}

function parseBridgeEmailDraft(raw: unknown): QuestionnaireEmailDraft | null {
  if (!raw || typeof raw !== 'object') return null
  const subject = (raw as { subject?: unknown }).subject
  const textBody = (raw as { textBody?: unknown }).textBody
  if (typeof subject !== 'string' || typeof textBody !== 'string') return null
  const trimmedSubject = subject.trim()
  const trimmedBody = textBody.trim()
  if (!trimmedSubject || !trimmedBody) return null
  return { subject: trimmedSubject, textBody: trimmedBody }
}

function parseBridgeUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const url = raw.trim()
  if (!url.startsWith('https://')) return null
  return url
}

export async function issueQuestionnaireLink(
  options: IssueQuestionnaireLinkOptions,
): Promise<IssueQuestionnaireLinkResult> {
  const { patientId, language = null, formTypes = null, sendEmail = false } = options
  let { newSession = false } = options
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
    .select('questionnaire_status, patient_email, form_types')
    .eq('id', patientId)
    .maybeSingle()

  const previousFormTypes = coercePatientFormTypes(existing?.form_types)

  if (existing?.questionnaire_status === 'completed') {
    return {
      ok: false,
      httpStatus: 409,
      error:
        'Questionnaire déjà complété — pour une nouvelle évaluation, créez un nouveau dossier patient.',
      code: 'completed',
    }
  }

  if (formTypes && formTypes.length > 0) {
    const normalizedTarget = normalizeFormTypes(formTypes)
    if (!formTypesEqual(previousFormTypes, normalizedTarget)) {
      const { error: formError } = await service
        .from('patients')
        .update({ form_types: normalizedTarget })
        .eq('id', patientId)
      if (formError) {
        log.error('Mise a jour form_types echouee', { patientId, formError })
        return {
          ok: false,
          httpStatus: 502,
          error: 'Erreur mise a jour du type de questionnaire',
          code: 'upstream',
        }
      }
      // Changement de pathologie : nouvelle session obligatoire (évite mélange cervical/lombaire).
      newSession = true
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

  const linkBody: QuestionnaireBridgeBody = {
    trackerPatientId: patientId,
    newSession,
    sendEmail,
    ...(existing?.patient_email ? { patientEmail: existing.patient_email } : {}),
  }

  let response = await postQuestionnaireBridgeSafe(linkBody, token)

  if (response?.status === 404) {
    log.warn('Dossier non corrélé — tentative de sync rattrapage', { patientId })
    const synced = await syncPatientToQuestionnaires(patientId)
    if (synced) {
      response = await postQuestionnaireBridgeSafe(linkBody, token)
    }
  }

  if (!response) {
    return {
      ok: false,
      httpStatus: 502,
      error: 'Le portail questionnaire est injoignable (délai dépassé ou réseau). Réessayez dans un instant.',
      code: 'upstream',
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

  const result = (await response.json()) as {
    emailSent?: boolean
    expiresAt?: string | null
    url?: unknown
    emailDraft?: unknown
  }
  const emailSent = result.emailSent ?? false
  const url = parseBridgeUrl(result.url)
  const emailDraft = parseBridgeEmailDraft(result.emailDraft)

  // Mode staff : url disponible — ne pas marquer sent tant que Marcel n'a pas confirmé.
  if (url) {
    return {
      ok: true,
      emailSent: false,
      expiresAt: result.expiresAt ?? null,
      url,
      emailDraft,
      effectiveNewSession: newSession,
      dispatchMode: 'staff',
    }
  }

  // Legacy : portail ignore sendEmail=false et envoie encore via Resend.
  if (emailSent) {
    await markQuestionnaireLinkIssued(patientId, true)
    return {
      ok: true,
      emailSent: true,
      expiresAt: result.expiresAt ?? null,
      url: null,
      emailDraft: null,
      effectiveNewSession: newSession,
      dispatchMode: 'legacy_resend',
    }
  }

  if (!sendEmail) {
    return {
      ok: false,
      httpStatus: 502,
      error:
        "Le portail questionnaire n'a pas renvoyé le lien (contrat sendEmail=false). Déployez la PR questionnaires jumelle, ou forcez l'envoi Resend temporairement.",
      code: 'url_missing',
    }
  }

  return {
    ok: false,
    httpStatus: 502,
    error:
      "Lien questionnaire généré mais ni URL ni email Resend confirmé. Vérifiez Resend côté questionnaires.",
    code: 'upstream',
  }
}

/**
 * Marque le dossier `sent` après confirmation staff (copie / mailto)
 * ou après envoi Resend legacy.
 */
export async function markQuestionnaireLinkIssued(
  patientId: string,
  confirmed: boolean,
): Promise<void> {
  if (!confirmed) return

  const service = createServiceRoleClient()
  const { data: current } = await service
    .from('patients')
    .select('questionnaire_status')
    .eq('id', patientId)
    .maybeSingle()

  if (current?.questionnaire_status !== 'completed') {
    await service.from('patients').update({
      questionnaire_status: 'sent',
      questionnaire_sent_at: new Date().toISOString(),
    }).eq('id', patientId)
  }
}

/**
 * Corrige un état tracker `sent` orphelin : pas de lien actif côté portail
 * et pas de sentAt Resend. Ne touche pas au dispatch staff (lien actif sans
 * Resend sentAt — Marcel a confirmé l'envoi manuellement).
 */
export async function reconcileQuestionnaireSentStatus(
  trackerPatientId: string,
  portalSentAt: string | null | undefined,
  currentTrackerStatus: string | null | undefined,
  hasActivePortalLink: boolean = false,
): Promise<boolean> {
  if (currentTrackerStatus !== 'sent' || portalSentAt || hasActivePortalLink) return false

  const service = createServiceRoleClient()
  const { error } = await service
    .from('patients')
    .update({ questionnaire_status: null, questionnaire_sent_at: null })
    .eq('id', trackerPatientId)
    .eq('questionnaire_status', 'sent')

  return !error
}

/** Rattrape les faux `sent` sur une liste (dashboard). Retourne les ids corrigés. */
export async function reconcileQuestionnaireSentStatusesForPatients(
  patients: Array<{ id: string; questionnaire_status: string | null }>,
): Promise<string[]> {
  const { fetchQuestionnaireStatus } = await import('@/lib/integrations/questionnaire-portal')
  const corrected: string[] = []

  await Promise.all(
    patients
      .filter((p) => p.questionnaire_status === 'sent')
      .map(async (p) => {
        const portalStatus = await fetchQuestionnaireStatus(p.id)
        const did = await reconcileQuestionnaireSentStatus(
          p.id,
          portalStatus?.activeLink?.sentAt,
          p.questionnaire_status,
          Boolean(portalStatus?.activeLink),
        )
        if (did) corrected.push(p.id)
      }),
  )

  return corrected
}
