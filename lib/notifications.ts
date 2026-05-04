import { Resend } from 'resend'
import type { DbStatusCode, Role } from '@/lib/constants'
import { staffRecipients } from '@/lib/access-control'
import { EMAIL_FROM, getEmailForProfile } from '@/lib/email-config'
import { Logger } from '@/lib/logger'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import {
  newPatientEmailHtml,
  newMessageEmailHtml,
  statusChangeEmailHtml,
} from '@/lib/email-templates'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.franchir.eu'
const log = new Logger('notifications')

function opaquePatientReference(patientId: string): string {
  const normalizedId = patientId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  return `DOS-${normalizedId.slice(0, 10)}`
}

function getResend(): Resend | null {
  return process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
}

export type ProfileRow = {
  id: string
  role: string
  full_name: string
  email?: string | null
}

type SupabaseClient = Awaited<ReturnType<typeof import('@/lib/supabase/server').createServerClient>>

type NotificationInsert = {
  user_id: string
  patient_id: string
  type: string
  title: string
  message: string
}

async function insertNotifications(
  rows: NotificationInsert[],
  context: string,
  scopedLog: Logger = log
): Promise<void> {
  try {
    const supabase = createServiceRoleClient() as unknown as SupabaseClient
    const { error } = await supabase
      .from('notifications')
      .insert(rows.map(row => ({ is_read: false, ...row })))

    if (error) {
      scopedLog.error(context, error)
    }
  } catch (error) {
    scopedLog.error(context, error)
  }
}

export function patientLink(patientId: string): string {
  return `${APP_URL}/dashboard/patient/${patientId}`
}

export async function sendNewPatientNotifications(
  supabase: SupabaseClient,
  actor: { id: string; full_name: string; role?: string },
  patient: { id: string; patient_name: string }
): Promise<void> {
  const scopedLog = log.withContext({ user_id: actor.id, role: actor.role, patient_id: patient.id })
  const { data: profiles } = await supabase.from('profiles').select('id, role, email, full_name')

  const targetProfiles = staffRecipients(profiles as ProfileRow[] | null, actor.id)

  if (targetProfiles.length === 0) return

  const link = patientLink(patient.id)
  const patientReference = opaquePatientReference(patient.id)

  await insertNotifications(
    targetProfiles.map(p => ({
      user_id: p.id,
      patient_id: patient.id,
      type: 'info',
      title: 'Nouveau dossier créé',
      message: `${actor.full_name} a créé le dossier de ${patient.patient_name}.`,
    })),
    'Failed to insert new patient notifications',
    scopedLog
  )

  const emailClient = getResend()
  if (!emailClient) return

  const emailPromises = targetProfiles
    .map(p => ({ ...p, realEmail: getEmailForProfile(p) }))
    .filter(p => p.realEmail)
    .map(p =>
      emailClient.emails.send({
        from: EMAIL_FROM,
        to: p.realEmail!,
        subject: `Nouveau dossier patient — Réf ${patientReference}`,
        html: newPatientEmailHtml(p.full_name, actor.full_name, patientReference, link),
      })
    )

  const results = await Promise.allSettled(emailPromises)
  results.forEach((r, i) => {
    if (r.status === 'rejected') scopedLog.error(`Email failed for profile ${i}`, r.reason)
  })
}

export async function sendNewMessageNotifications(
  supabase: SupabaseClient,
  actor: { id: string; full_name: string; role?: string },
  patient: { id: string; patient_name: string }
): Promise<void> {
  const scopedLog = log.withContext({ user_id: actor.id, role: actor.role, patient_id: patient.id })
  const { data: profiles } = await supabase.from('profiles').select('id, role, email, full_name')

  const targetProfiles = staffRecipients(profiles as ProfileRow[] | null, actor.id)

  if (targetProfiles.length === 0) return

  const link = patientLink(patient.id)
  const patientReference = opaquePatientReference(patient.id)

  await insertNotifications(
    targetProfiles.map(p => ({
      user_id: p.id,
      patient_id: patient.id,
      type: 'message',
      title: 'Nouveau message',
      message: `${actor.full_name} a écrit un message`,
    })),
    'Failed to insert message notifications',
    scopedLog
  )

  const emailClient = getResend()
  if (!emailClient) return

  const emailPromises = targetProfiles
    .map(p => ({ ...p, realEmail: getEmailForProfile(p) }))
    .filter(p => p.realEmail)
    .map(p =>
      emailClient.emails.send({
        from: EMAIL_FROM,
        to: p.realEmail!,
        subject: `Nouveau message dossier patient — Réf ${patientReference}`,
        html: newMessageEmailHtml(p.full_name, actor.full_name, patientReference, link),
      })
    )

  const results = await Promise.allSettled(emailPromises)
  results.forEach((r, i) => {
    if (r.status === 'rejected') scopedLog.error(`Email failed for profile ${i}`, r.reason)
  })
}

export const STATUS_NOTIFICATION_RULES: Record<
  DbStatusCode,
  { roles: Role[]; message: (patientReference: string) => string; emailMessage: string }
> = {
  medical_review: {
    roles: ['gilles'],
    message: patientReference => `Le dossier ${patientReference} est prêt pour votre revue médicale.`,
    emailMessage: 'Le dossier est prêt pour votre revue médicale.',
  },
  validated_medical: {
    roles: ['marcel', 'franchir', 'admin'],
    message: patientReference =>
      `Le dossier ${patientReference} a été validé médicalement. Vous pouvez préparer le devis.`,
    emailMessage: 'Le dossier a été validé médicalement. Vous pouvez préparer le devis.',
  },
  rejected_medical: {
    roles: ['marcel', 'franchir', 'admin'],
    message: patientReference => `Le dossier ${patientReference} a été refusé médicalement.`,
    emailMessage: 'Le dossier a été refusé médicalement.',
  },
  need_info: {
    roles: ['marcel', 'franchir', 'admin'],
    message: patientReference =>
      `Des informations supplémentaires sont demandées pour ${patientReference}.`,
    emailMessage: 'Des informations supplémentaires sont demandées.',
  },
  surgery_scheduled: {
    roles: ['gilles', 'marcel', 'franchir', 'admin'],
    message: patientReference => `La chirurgie du dossier ${patientReference} a été programmée.`,
    emailMessage: 'La chirurgie a été programmée.',
  },
  draft: {
    roles: ['marcel', 'franchir', 'admin'],
    message: patientReference => `Le dossier ${patientReference} a été réouvert.`,
    emailMessage: 'Le dossier a été réouvert.',
  },
  prospect_created: {
    roles: ['marcel', 'franchir', 'admin'],
    message: patientReference => `Le dossier ${patientReference} a été créé.`,
    emailMessage: 'Un dossier patient a été créé.',
  },
}

export async function sendStatusChangeNotifications(
  supabase: SupabaseClient,
  actor: { id: string; role?: string },
  patient: { id: string; patient_name: string },
  newStatusCode: DbStatusCode
): Promise<void> {
  const scopedLog = log.withContext({ user_id: actor.id, role: actor.role, patient_id: patient.id })
  const rule = STATUS_NOTIFICATION_RULES[newStatusCode]
  if (!rule) return

  const patientReference = opaquePatientReference(patient.id)
  const statusMessage = rule.message(patientReference)
  const link = patientLink(patient.id)

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, role, full_name, email')
    .in('role', rule.roles)

  if (error) {
    scopedLog.error('Failed to fetch target users for status notification', error)
    return
  }

  const targetUsers = staffRecipients(profiles as ProfileRow[] | null, actor.id)

  if (targetUsers.length === 0) return

  await insertNotifications(
    targetUsers.map(u => ({
      user_id: u.id,
      patient_id: patient.id,
      title: 'Nouveau statut patient',
      message: statusMessage,
      type: 'info',
    })),
    'Failed to insert status notifications',
    scopedLog
  )

  const emailClient = getResend()
  if (!emailClient) return

  const emailPromises = targetUsers
    .map(u => ({ ...u, realEmail: getEmailForProfile(u) }))
    .filter(u => u.realEmail)
    .map(u =>
      emailClient.emails.send({
        from: EMAIL_FROM,
        to: u.realEmail!,
        subject: `Mise à jour dossier patient — Réf ${patientReference}`,
        html: statusChangeEmailHtml(u.full_name, rule.emailMessage, patientReference, link),
      })
    )

  const results = await Promise.allSettled(emailPromises)
  results.forEach((r, i) => {
    if (r.status === 'rejected') scopedLog.error(`Email failed for user ${i}`, r.reason)
  })
}
