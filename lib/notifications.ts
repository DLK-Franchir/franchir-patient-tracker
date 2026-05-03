import { Resend } from 'resend'
import { staffRecipients } from '@/lib/access-control'
import { EMAIL_FROM, getEmailForProfile } from '@/lib/email-config'
import { Logger } from '@/lib/logger'
import {
  newPatientEmailHtml,
  newMessageEmailHtml,
  statusChangeEmailHtml,
} from '@/lib/email-templates'

const resend = new Resend(process.env.RESEND_API_KEY)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.franchir.eu'
const log = new Logger('notifications')

export type ProfileRow = {
  id: string
  role: string
  full_name: string
  email?: string | null
}

type SupabaseClient = Awaited<ReturnType<typeof import('@/lib/supabase/server').createServerClient>>

function canSendEmails(): boolean {
  return Boolean(process.env.RESEND_API_KEY)
}

export function patientLink(patientId: string): string {
  return `${APP_URL}/dashboard/patient/${patientId}`
}

export async function sendNewPatientNotifications(
  supabase: SupabaseClient,
  actor: { id: string; full_name: string },
  patient: { id: string; patient_name: string }
): Promise<void> {
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, role, email, full_name')

  const targetProfiles = staffRecipients(profiles as ProfileRow[] | null, actor.id)

  if (targetProfiles.length === 0) return

  const link = patientLink(patient.id)

  const { error: insertError } = await supabase.from('notifications').insert(
    targetProfiles.map((p) => ({
      user_id: p.id,
      patient_id: patient.id,
      type: 'info',
      title: 'Nouveau dossier créé',
      message: `${actor.full_name} a créé le dossier de ${patient.patient_name}.`,
    }))
  )

  if (insertError) log.error('Failed to insert new patient notifications', insertError)
  if (!canSendEmails()) return

  const emailPromises = targetProfiles
    .map((p) => ({ ...p, realEmail: getEmailForProfile(p) }))
    .filter((p) => p.realEmail)
    .map((p) =>
      resend.emails.send({
        from: EMAIL_FROM,
        to: p.realEmail!,
        subject: `Nouveau dossier créé — ${patient.patient_name}`,
        html: newPatientEmailHtml(p.full_name, actor.full_name, patient.patient_name, link),
      })
    )

  const results = await Promise.allSettled(emailPromises)
  results.forEach((r, i) => {
    if (r.status === 'rejected') log.error(`Email failed for profile ${i}`, r.reason)
  })
}

export async function sendNewMessageNotifications(
  supabase: SupabaseClient,
  actor: { id: string; full_name: string },
  patient: { id: string; patient_name: string },
  message: string
): Promise<void> {
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, role, email, full_name')

  const targetProfiles = staffRecipients(profiles as ProfileRow[] | null, actor.id)

  if (targetProfiles.length === 0) return

  const link = patientLink(patient.id)

  const { error: insertError } = await supabase.from('notifications').insert(
    targetProfiles.map((p) => ({
      user_id: p.id,
      patient_id: patient.id,
      type: 'message',
      title: 'Nouveau message',
      message: `${actor.full_name} a écrit un message`,
    }))
  )

  if (insertError) log.error('Failed to insert message notifications', insertError)
  if (!canSendEmails()) return

  const emailPromises = targetProfiles
    .map((p) => ({ ...p, realEmail: getEmailForProfile(p) }))
    .filter((p) => p.realEmail)
    .map((p) =>
      resend.emails.send({
        from: EMAIL_FROM,
        to: p.realEmail!,
        subject: `Nouveau message de ${actor.full_name} — ${patient.patient_name}`,
        html: newMessageEmailHtml(p.full_name, actor.full_name, patient.patient_name, message, link),
      })
    )

  const results = await Promise.allSettled(emailPromises)
  results.forEach((r, i) => {
    if (r.status === 'rejected') log.error(`Email failed for profile ${i}`, r.reason)
  })
}

export const STATUS_NOTIFICATION_RULES: Record<string, { roles: string[]; message: (name: string) => string }> = {
  medical_review: {
    roles: ['gilles'],
    message: (name) => `Le dossier de ${name} est prêt pour votre revue médicale.`,
  },
  validated_medical: {
    roles: ['marcel', 'franchir', 'admin'],
    message: (name) => `Le dossier de ${name} a été validé médicalement. Vous pouvez préparer le devis.`,
  },
  rejected_medical: {
    roles: ['marcel', 'franchir', 'admin'],
    message: (name) => `Le dossier de ${name} a été refusé médicalement.`,
  },
  need_info: {
    roles: ['marcel', 'franchir', 'admin'],
    message: (name) => `Des informations supplémentaires sont demandées pour ${name}.`,
  },
  surgery_scheduled: {
    roles: ['gilles', 'marcel', 'franchir', 'admin'],
    message: (name) => `La chirurgie de ${name} a été programmée.`,
  },
  draft: {
    roles: ['marcel', 'franchir', 'admin'],
    message: (name) => `Le dossier de ${name} a été réouvert.`,
  },
}

export async function sendStatusChangeNotifications(
  supabase: SupabaseClient,
  actor: { id: string },
  patient: { id: string; patient_name: string },
  newStatusCode: string
): Promise<void> {
  const rule = STATUS_NOTIFICATION_RULES[newStatusCode]
  if (!rule) return

  const statusMessage = rule.message(patient.patient_name)
  const link = patientLink(patient.id)

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, role, full_name, email')
    .in('role', rule.roles)

  if (error) {
    log.error('Failed to fetch target users for status notification', error)
    return
  }

  const targetUsers = staffRecipients(profiles as ProfileRow[] | null, actor.id)

  if (targetUsers.length === 0) return

  const { error: insertError } = await supabase.from('notifications').insert(
    targetUsers.map((u) => ({
      user_id: u.id,
      patient_id: patient.id,
      title: 'Nouveau statut patient',
      message: statusMessage,
      type: 'info',
    }))
  )

  if (insertError) log.error('Failed to insert status notifications', insertError)
  if (!canSendEmails()) return

  const emailPromises = targetUsers
    .map((u) => ({ ...u, realEmail: getEmailForProfile(u) }))
    .filter((u) => u.realEmail)
    .map((u) =>
      resend.emails.send({
        from: EMAIL_FROM,
        to: u.realEmail!,
        subject: `Mise à jour dossier — ${patient.patient_name}`,
        html: statusChangeEmailHtml(u.full_name, statusMessage, link),
      })
    )

  const results = await Promise.allSettled(emailPromises)
  results.forEach((r, i) => {
    if (r.status === 'rejected') log.error(`Email failed for user ${i}`, r.reason)
  })
}
