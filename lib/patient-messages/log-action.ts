import type { SupabaseClient } from '@supabase/supabase-js'
import type { Logger } from '@/lib/logger'
import type { ActionId } from '@/lib/workflow-v2'

export type PatientMessageKind = 'message' | 'status_change' | 'system' | 'action'
export type PatientMessageTopic = 'medical' | 'commercial' | 'audit' | 'system'

/**
 * Identifiants d'événements connus dans `patient_messages.meta.action_id`.
 * Union faible : les appels existants restent valides, mais un nouvel
 * `action_id` doit être déclaré ici pour rester reconstructible a posteriori.
 */
export type PatientActionId =
  | ActionId
  | 'create_patient'
  | 'edit_commercial_data'
  | 'edit_summary'
  | 'document_deleted'
  | 'questionnaire_prepare'
  | 'questionnaire_new_session'
  | 'questionnaire_resend'
  | 'questionnaire_staff_dispatch'
  | 'questionnaire_completed'
  | 'dicom_study_export'
  | 'dicom_series_export'
  | 'dicom_study_export_async_create'
  | 'dicom_study_export_async_build'

export type PatientActionMeta = Record<string, unknown> & { action_id?: PatientActionId }

/** Auteur humain (profil staff authentifié). */
export type PatientActionStaffAuthor = {
  id: string
  full_name: string | null
  role: string
}

/** Auteur machine (callback M2M, jobs) : pas de profil, `author_id` NULL en base. */
export type PatientActionSystemAuthor = {
  id: null
  full_name: string
  role: 'system'
}

export type PatientActionAuthor = PatientActionStaffAuthor | PatientActionSystemAuthor

export const QUESTIONNAIRES_SYSTEM_AUTHOR: PatientActionSystemAuthor = {
  id: null,
  full_name: 'Questionnaires',
  role: 'system',
}

export type LogPatientActionParams = {
  patientId: string
  author: PatientActionAuthor
  kind: PatientMessageKind
  title: string
  body: string
  topic: PatientMessageTopic
  meta?: PatientActionMeta
}

export async function logPatientAction(
  supabase: SupabaseClient,
  params: LogPatientActionParams,
  log?: Logger,
  logContext?: Record<string, unknown>,
): Promise<{ ok: boolean }> {
  const { patientId, author, kind, title, body, topic, meta } = params

  try {
    const { error } = await supabase.from('patient_messages').insert({
      patient_id: patientId,
      author_id: author.id,
      author_name: author.full_name,
      author_role: author.role,
      kind,
      title,
      body,
      topic,
      meta: meta ?? null,
    })

    if (error) {
      log?.warn('Journal action patient non enregistre', {
        patientId,
        kind,
        title,
        ...logContext,
        error,
      })
      return { ok: false }
    }

    return { ok: true }
  } catch (error) {
    // Le journal ne doit jamais faire échouer l'écriture métier déjà effectuée.
    log?.warn('Journal action patient non enregistre (exception)', {
      patientId,
      kind,
      title,
      ...logContext,
      error: error instanceof Error ? error.message : String(error),
    })
    return { ok: false }
  }
}
