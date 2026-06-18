export type QuestionnaireLanguage = 'fr' | 'en'

/** Parse une langue questionnaire depuis une entrée API ou DB. */
export function parseQuestionnaireLanguage(
  v: unknown,
  fallback?: QuestionnaireLanguage,
): QuestionnaireLanguage | undefined {
  if (v === 'en' || v === 'fr') return v
  return fallback
}
