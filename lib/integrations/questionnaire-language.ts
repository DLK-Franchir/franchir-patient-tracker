export {
  parseQuestionnaireLanguage,
  type QuestionnaireLanguage,
} from '../../supabase/functions/_shared/questionnaire-language'

import {
  parseQuestionnaireLanguage,
  type QuestionnaireLanguage,
} from '../../supabase/functions/_shared/questionnaire-language'

/** Langue explicite dans le body d'émission de lien (absent = pas de mise à jour). */
export function parseQuestionnaireLanguageFromLinkBody(
  body: unknown,
): QuestionnaireLanguage | null {
  if (typeof body !== 'object' || body === null || !('language' in body)) {
    return null
  }
  const { language } = body as { language?: unknown }
  if (language === undefined || language === null) return null
  return parseQuestionnaireLanguage(language, 'fr') ?? null
}
