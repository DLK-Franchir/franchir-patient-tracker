import type { QuestionnaireLanguage } from '@/lib/integrations/questionnaire-language'

interface QuestionnaireLanguageSelectorProps {
  value: QuestionnaireLanguage
  onChange: (language: QuestionnaireLanguage) => void
  disabled?: boolean
  required?: boolean
  /** Texte d'aide sous le titre (optionnel). */
  hint?: string
  className?: string
}

export function QuestionnaireLanguageSelector({
  value,
  onChange,
  disabled = false,
  required = false,
  hint,
  className = '',
}: QuestionnaireLanguageSelectorProps) {
  return (
    <div className={className}>
      <p className="text-sm font-semibold text-gray-800 mb-2">
        Langue du questionnaire{required ? ' *' : ''}
      </p>
      {hint ? <p className="text-xs text-gray-500 mb-3">{hint}</p> : null}
      <div className="flex gap-2">
        {(['fr', 'en'] as const).map((lang) => {
          const active = value === lang
          return (
            <button
              key={lang}
              type="button"
              onClick={() => onChange(lang)}
              disabled={disabled}
              className={`flex-1 text-sm font-bold px-4 py-2.5 rounded-lg border-2 transition ${
                active
                  ? 'bg-[#2563EB] text-white border-[#2563EB]'
                  : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
              } disabled:opacity-50`}
            >
              {lang === 'fr' ? 'Français' : 'English'}
            </button>
          )
        })}
      </div>
    </div>
  )
}
