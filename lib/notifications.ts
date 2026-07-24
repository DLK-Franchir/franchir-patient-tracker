import { Resend } from 'resend'
import { staffRecipients } from '@/lib/access-control'
import { EMAIL_FROM, getEmailForProfile } from '@/lib/email-config'
import { staffEmailTags } from '@/lib/email-tags'
import { Logger } from '@/lib/logger'
import {
  newPatientEmailHtml,
  newMessageEmailHtml,
  statusChangeEmailHtml,
} from '@/lib/email-templates'

const resend = new Resend(process.env.RESEND_API_KEY)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://patients.franchir.eu'
// Portail clinicien/chirurgien (app questionnaires) où le chirurgien consulte
// l'analyse sécurisée + l'imagerie du dossier qui lui est assigné.
const QUESTIONNAIRES_PORTAL_URL =
  process.env.QUESTIONNAIRES_PORTAL_URL || 'https://questionnaire.franchir.eu'
const log = new Logger('notifications')

/** Les messages internes alimentent déjà le cockpit « Mes actions » — pas de notif in-app. */
export const SKIP_INAPP_MESSAGE_NOTIFICATIONS = true

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
        tags: staffEmailTags('new_patient', { patient_id: patient.id }),
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

  if (!SKIP_INAPP_MESSAGE_NOTIFICATIONS) {
    const { error: insertError } = await supabase.from('notifications').insert(
      targetProfiles.map((p) => ({
        user_id: p.id,
        patient_id: patient.id,
        type: 'message',
        title: 'Nouveau message',
        message: `${actor.full_name} a écrit un message`,
      })),
    )
    if (insertError) log.error('Failed to insert message notifications', insertError)
  }

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
        tags: staffEmailTags('new_message', { patient_id: patient.id }),
      })
    )

  const results = await Promise.allSettled(emailPromises)
  results.forEach((r, i) => {
    if (r.status === 'rejected') log.error(`Email failed for profile ${i}`, r.reason)
  })
}

/**
 * Email envoyé au chirurgien lorsqu'un dossier lui est assigné (validation
 * Gilles/Erik). Le chirurgien accède à l'analyse sécurisée du questionnaire +
 * l'imagerie via le portail clinicien de l'app questionnaires (login + RLS :
 * le dossier devient visible une fois `surgeon_email` enrichi par le webhook).
 */
export async function sendSurgeonAssignmentEmail(
  surgeon: { full_name: string | null; email: string | null },
  patientName: string
): Promise<void> {
  if (!canSendEmails() || !surgeon.email) return

  const portalLink = `${QUESTIONNAIRES_PORTAL_URL}/clinician`

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: surgeon.email,
      subject: `Nouveau dossier à étudier — ${patientName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
          <h2 style="color: #2563EB;">Dossier patient assigné</h2>
          <p>Bonjour ${surgeon.full_name ?? ''},</p>
          <p>Le dossier de <strong>${patientName}</strong> vous a été confié pour étude,
          recommandations et proposition chirurgicale.</p>
          <p>Vous pouvez consulter l'<strong>analyse sécurisée du questionnaire</strong> et
          l'<strong>imagerie</strong> du patient sur votre portail :</p>
          <p style="margin: 24px 0;">
            <a href="${portalLink}"
               style="background:#2563EB;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">
              Accéder au dossier sécurisé
            </a>
          </p>
          <p style="font-size:12px;color:#6b7280;">Accès réservé : connectez-vous avec votre compte chirurgien.
          Le dossier n'est visible que des praticiens qui y sont rattachés.</p>
        </div>
      `,
      tags: staffEmailTags('surgeon_assignment'),
    })
  } catch (error) {
    log.error('Échec envoi email assignation chirurgien', error)
  }
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

export type CommercialActionId = 'add_budget' | 'confirm_quote' | 'propose_dates'

export const COMMERCIAL_ACTION_NOTIFICATION_RULES: Record<
  CommercialActionId,
  { roles: string[]; message: (name: string) => string }
> = {
  add_budget: {
    roles: ['franchir', 'admin'],
    message: (name) => `Un budget indicatif a été saisi pour ${name}.`,
  },
  confirm_quote: {
    roles: ['gilles', 'franchir', 'admin'],
    message: (name) => `Le devis de ${name} a été confirmé par Marcel.`,
  },
  propose_dates: {
    roles: ['franchir', 'admin'],
    message: (name) => `Des dates de chirurgie ont été proposées pour ${name}.`,
  },
}

export async function sendCommercialActionNotifications(
  supabase: SupabaseClient,
  actor: { id: string },
  patient: { id: string; patient_name: string },
  actionId: CommercialActionId,
): Promise<void> {
  const rule = COMMERCIAL_ACTION_NOTIFICATION_RULES[actionId]
  if (!rule) return

  const statusMessage = rule.message(patient.patient_name)
  const link = patientLink(patient.id)

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, role, full_name, email')
    .in('role', rule.roles)

  if (error) {
    log.error('Failed to fetch users for commercial notification', error)
    return
  }

  const targetUsers = staffRecipients(profiles as ProfileRow[] | null, actor.id)
  if (targetUsers.length === 0) return

  const { error: insertError } = await supabase.from('notifications').insert(
    targetUsers.map((u) => ({
      user_id: u.id,
      patient_id: patient.id,
      title: 'Action commerciale',
      message: statusMessage,
      type: 'info',
    })),
  )

  if (insertError) log.error('Failed to insert commercial notifications', insertError)
  if (!canSendEmails()) return

  const emailPromises = targetUsers
    .map((u) => ({ ...u, realEmail: getEmailForProfile(u) }))
    .filter((u) => u.realEmail)
    .map((u) =>
      resend.emails.send({
        from: EMAIL_FROM,
        to: u.realEmail!,
        subject: `Action commerciale — ${patient.patient_name}`,
        html: statusChangeEmailHtml(u.full_name, statusMessage, link),
        tags: staffEmailTags('commercial_action', {
          patient_id: patient.id,
          action: actionId,
        }),
      }),
    )

  const results = await Promise.allSettled(emailPromises)
  results.forEach((r, i) => {
    if (r.status === 'rejected') log.error(`Commercial email failed for user ${i}`, r.reason)
  })
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
        tags: staffEmailTags('status_change', {
          patient_id: patient.id,
          status: newStatusCode,
        }),
      })
    )

  const results = await Promise.allSettled(emailPromises)
  results.forEach((r, i) => {
    if (r.status === 'rejected') log.error(`Email failed for user ${i}`, r.reason)
  })
}
