import type { SupabaseClient } from '@supabase/supabase-js'
import type { Logger } from '@/lib/logger'

export type PatientMessageKind = 'message' | 'status_change' | 'system' | 'action'
export type PatientMessageTopic = 'medical' | 'commercial' | 'audit' | 'system'

export type PatientActionAuthor = {
  id: string
  full_name: string | null
  role: string
}

export type LogPatientActionParams = {
  patientId: string
  author: PatientActionAuthor
  kind: PatientMessageKind
  title: string
  body: string
  topic: PatientMessageTopic
  meta?: Record<string, unknown>
}

export async function logPatientAction(
  supabase: SupabaseClient,
  params: LogPatientActionParams,
  log?: Logger,
  logContext?: Record<string, unknown>,
): Promise<{ ok: boolean }> {
  const { patientId, author, kind, title, body, topic, meta } = params

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
}
