import type { QuestionnaireLanguage } from '@/lib/integrations/questionnaire-language'
import type { QuestionnaireFormType } from '@/lib/integrations/questionnaire-form-types'
import { formatFormTypesLabel } from '@/lib/integrations/questionnaire-form-types'
import { formatQuestionnaireLanguageLabel } from '@/lib/integrations/questionnaire-language-label'

export function formatQuestionnaireResendNote(emailSent: boolean): string {
  return emailSent ? 'Email envoyé au patient.' : 'Lien généré (email non confirmé).'
}

export function formatQuestionnaireCreationNote(params: {
  ok: boolean
  emailSent?: boolean
  error?: string
}): string {
  if (!params.ok) {
    return `Échec envoi questionnaire : ${params.error ?? 'erreur inconnue'}`
  }
  if (params.emailSent) {
    return 'Questionnaire envoyé par email au patient.'
  }
  return 'Lien questionnaire généré (email non confirmé — renvoyer depuis la fiche patient).'
}

export function formatQuestionnaireAuditBody(params: {
  pathologyLabel: string
  language: QuestionnaireLanguage
  sendNote: string
}): string {
  return `Questionnaire ${params.pathologyLabel} en ${formatQuestionnaireLanguageLabel(params.language)} — ${params.sendNote}`
}

export function formatQuestionnaireAuditBodyFromFormTypes(params: {
  formTypes: QuestionnaireFormType[]
  language: QuestionnaireLanguage
  sendNote: string
}): string {
  return formatQuestionnaireAuditBody({
    pathologyLabel: formatFormTypesLabel(params.formTypes),
    language: params.language,
    sendNote: params.sendNote,
  })
}

export function formatPatientCreationAuditBody(params: {
  authorName: string | null
  formTypes: QuestionnaireFormType[]
  language: QuestionnaireLanguage
  sendNote: string
}): string {
  const pathologyLabel = formatFormTypesLabel(params.formTypes)
  const languageLabel = formatQuestionnaireLanguageLabel(params.language)
  return `Dossier créé par ${params.authorName ?? 'coordinateur'}. Questionnaire ${pathologyLabel} en ${languageLabel} — ${params.sendNote}`
}
