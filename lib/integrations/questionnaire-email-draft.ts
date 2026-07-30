/**
 * Brouillon email patient (plain text) pour dispatch staff (copier / mailto).
 * Aligné sur le sujet Resend connu côté questionnaires ; le corps peut être
 * remplacé par `emailDraft` renvoyé par le pont quand disponible.
 */

import type { QuestionnaireFormType } from '@/lib/integrations/questionnaire-form-types'
import { formatFormTypesLabel } from '@/lib/integrations/questionnaire-form-types'
import type { QuestionnaireLanguage } from '@/lib/integrations/questionnaire-language'

export type QuestionnaireEmailDraft = {
  subject: string
  textBody: string
}

export const QUESTIONNAIRE_EMAIL_SUBJECT_FR = 'Votre questionnaire médical Franchir'
export const QUESTIONNAIRE_EMAIL_SUBJECT_EN = 'Your Franchir medical questionnaire'

export function buildQuestionnaireEmailDraft(params: {
  language: QuestionnaireLanguage
  formTypes: QuestionnaireFormType[]
  patientName?: string | null
  questionnaireUrl: string
}): QuestionnaireEmailDraft {
  const pathology = formatFormTypesLabel(params.formTypes)
  const url = params.questionnaireUrl.trim()
  const name = params.patientName?.trim()

  if (params.language === 'en') {
    const greeting = name ? `Hello ${name},` : 'Hello,'
    return {
      subject: QUESTIONNAIRE_EMAIL_SUBJECT_EN,
      textBody: [
        greeting,
        '',
        `Please complete your Franchir medical questionnaire (${pathology}) using the secure link below:`,
        '',
        url,
        '',
        'This link is personal and time-limited. If you have any trouble opening it, reply to this email or contact the clinic.',
        '',
        'Thank you,',
        'The Franchir team',
      ].join('\n'),
    }
  }

  const greeting = name ? `Bonjour ${name},` : 'Bonjour,'
  return {
    subject: QUESTIONNAIRE_EMAIL_SUBJECT_FR,
    textBody: [
      greeting,
      '',
      `Merci de compléter votre questionnaire médical Franchir (${pathology}) via le lien sécurisé ci-dessous :`,
      '',
      url,
      '',
      'Ce lien est personnel et à durée limitée. En cas de difficulté, répondez à cet e-mail ou contactez la clinique.',
      '',
      'Cordialement,',
      "L'équipe Franchir",
    ].join('\n'),
  }
}

/** Corps mailto : garde le texte court pour limiter les troncatures client. */
export function buildMailtoHref(params: {
  to: string
  subject: string
  textBody: string
}): string {
  const to = params.to.trim()
  const subject = encodeURIComponent(params.subject)
  const body = encodeURIComponent(params.textBody)
  return `mailto:${encodeURIComponent(to)}?subject=${subject}&body=${body}`
}

export function composeDispatchClipboardText(params: {
  to: string
  subject: string
  textBody: string
}): string {
  return [`À : ${params.to}`, `Objet : ${params.subject}`, '', params.textBody].join('\n')
}
