'use client'

import { Mail, Phone } from 'lucide-react'
import {
  type QuestionnaireFormType,
  formatFormTypesLabel,
  normalizeFormTypes,
  resolveParcoursDisplayLabel,
} from '@/lib/integrations/questionnaire-form-types'

interface PatientDossierIdentityCardProps {
  patientName: string
  patientEmail?: string | null
  patientPhone?: string | null
  questionnaireLanguage: 'fr' | 'en'
  formTypes: QuestionnaireFormType[]
  /** When synthesis preview is loaded, matches questionnaire answers (source of truth). */
  parcoursLabel?: string | null
  clinicalSummary?: string | null
  showClinicalSummary?: boolean
}

function FormTypeBadges({ types }: { types: QuestionnaireFormType[] }) {
  const normalized = normalizeFormTypes(types)
  return (
    <div className="flex flex-wrap gap-2">
      {normalized.includes('cervical') && (
        <span className="inline-flex items-center rounded-lg border border-blue-500 bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
          Cervical
        </span>
      )}
      {normalized.includes('lombaire') && (
        <span className="inline-flex items-center rounded-lg border border-emerald-500 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
          Lombaire
        </span>
      )}
    </div>
  )
}

function languageDisplayLabel(language: 'fr' | 'en'): string {
  return language === 'en' ? 'English' : 'Français'
}

export function PatientDossierIdentityCard({
  patientName,
  patientEmail,
  patientPhone,
  questionnaireLanguage,
  formTypes,
  parcoursLabel,
  clinicalSummary,
  showClinicalSummary = true,
}: PatientDossierIdentityCardProps) {
  const languageLabel = languageDisplayLabel(questionnaireLanguage)
  const displayParcours = resolveParcoursDisplayLabel({ spineRegionLabel: parcoursLabel, formTypes })
  const trackerParcours = formatFormTypesLabel(formTypes)
  const parcoursMismatch =
    Boolean(parcoursLabel?.trim()) && displayParcours !== trackerParcours

  return (
    <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
      <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Identité du dossier</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Patient</p>
          <p className="text-base font-semibold text-gray-900">{patientName}</p>
        </div>

        {patientEmail ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Email</p>
            <p className="flex items-center gap-2 text-sm text-gray-800">
              <Mail className="size-4 shrink-0 text-gray-400" aria-hidden="true" />
              {patientEmail}
            </p>
          </div>
        ) : null}

        {patientPhone ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Téléphone</p>
            <p className="flex items-center gap-2 text-sm text-gray-800">
              <Phone className="size-4 shrink-0 text-gray-400" aria-hidden="true" />
              {patientPhone}
            </p>
          </div>
        ) : null}

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
            Langue du questionnaire
          </p>
          <p className="text-sm font-medium text-gray-900">{languageLabel}</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
            Type de questionnaire
          </p>
          <FormTypeBadges types={formTypes} />
          <p className="mt-1.5 text-xs text-gray-500">{displayParcours}</p>
          {parcoursMismatch ? (
            <p className="mt-1 text-xs text-amber-700">
              Parcours questionnaire ({displayParcours}) — type émis au dossier : {trackerParcours}
            </p>
          ) : null}
        </div>
      </div>

      {showClinicalSummary ? (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
            Résumé pathologie / clinique
          </p>
          <div className="rounded-lg bg-gray-50 p-3 sm:p-4 text-sm text-gray-700 whitespace-pre-wrap">
            {clinicalSummary?.trim() ? clinicalSummary : (
              <span className="italic text-gray-400">Aucun résumé clinique fourni.</span>
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}
