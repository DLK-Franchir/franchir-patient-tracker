import type { QuestionnaireLanguage } from '@/lib/integrations/questionnaire-language'

export function formatQuestionnaireLanguageLabel(language: QuestionnaireLanguage): string {
  return language === 'en' ? 'anglais' : 'français'
}
