'use client'

import type { ReactNode } from 'react'
import { CheckCircle, Clock, Stethoscope } from 'lucide-react'
import { BRAND } from '@/lib/brand-tokens'
import {
  type QuestionnaireFormType,
  formatFormTypesLabel,
  normalizeFormTypes,
  resolveParcoursDisplayLabel,
} from '@/lib/integrations/questionnaire-form-types'

interface PatientDossierIdentityCardProps {
  questionnaireLanguage: 'fr' | 'en'
  formTypes: QuestionnaireFormType[]
  /** When synthesis preview is loaded, matches questionnaire answers (source of truth). */
  parcoursLabel?: string | null
  clinicalSummary?: string | null
  showClinicalSummary?: boolean
  /** Données commerciales en lecture seule (édition via panneau actions). */
  showCommercialData?: boolean
  quoteAmount?: number | null
  proposedDate?: string | null
  quoteAccepted?: boolean
  dateAccepted?: boolean
  assignedSurgeonName?: string | null
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

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <p
      className="mb-1.5 text-[11px] font-bold uppercase tracking-wider"
      style={{ color: BRAND.slateLight }}
    >
      {children}
    </p>
  )
}

function FieldValue({ children }: { children: ReactNode }) {
  return (
    <p className="text-base font-bold leading-snug" style={{ color: BRAND.dark }}>
      {children}
    </p>
  )
}

function CommercialDataField({
  label,
  value,
  confirmed,
}: {
  label: string
  value: string
  confirmed?: boolean
}) {
  return (
    <div className="border-b pb-3 last:border-0 last:pb-0" style={{ borderColor: BRAND.cream }}>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex flex-wrap items-center gap-2">
        <FieldValue>{value}</FieldValue>
        {confirmed !== undefined &&
          (confirmed ? (
            <CheckCircle size={14} className="shrink-0 text-green-600" aria-label="Confirmé" />
          ) : (
            <Clock size={14} className="shrink-0 text-amber-600" aria-label="En attente" />
          ))}
      </div>
    </div>
  )
}

export function PatientDossierIdentityCard({
  questionnaireLanguage,
  formTypes,
  parcoursLabel,
  clinicalSummary,
  showClinicalSummary = true,
  showCommercialData = false,
  quoteAmount,
  proposedDate,
  quoteAccepted = false,
  dateAccepted = false,
  assignedSurgeonName,
}: PatientDossierIdentityCardProps) {
  const languageLabel = languageDisplayLabel(questionnaireLanguage)
  const displayParcours = resolveParcoursDisplayLabel({ spineRegionLabel: parcoursLabel, formTypes })
  const trackerParcours = formatFormTypesLabel(formTypes)
  const parcoursMismatch =
    Boolean(parcoursLabel?.trim()) && displayParcours !== trackerParcours

  return (
    <section
      className="overflow-hidden rounded-2xl shadow-sm"
      style={{ background: 'white', border: `1px solid ${BRAND.creamMid}` }}
    >
      <div
        className="flex items-center gap-2 px-5 py-4"
        style={{ background: BRAND.navy, borderBottom: `1px solid ${BRAND.navyDark}` }}
      >
        <Stethoscope size={16} className="text-white/90" aria-hidden />
        <h2 className="text-xs font-extrabold uppercase tracking-widest text-white">
          Informations du dossier
        </h2>
      </div>

      <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
        <div>
          <FieldLabel>Parcours / pathologie</FieldLabel>
          <FieldValue>{displayParcours}</FieldValue>
          <div className="mt-2">
            <FormTypeBadges types={formTypes} />
          </div>
          {parcoursMismatch ? (
            <p className="mt-2 text-xs text-amber-700">
              Parcours questionnaire ({displayParcours}) — type émis au dossier : {trackerParcours}
            </p>
          ) : null}
        </div>

        <div>
          <FieldLabel>Langue du questionnaire</FieldLabel>
          <FieldValue>{languageLabel}</FieldValue>
        </div>
      </div>

      {showClinicalSummary ? (
        <div className="border-t px-5 py-5 sm:px-6" style={{ borderColor: BRAND.creamMid }}>
          <FieldLabel>Résumé pathologie / clinique</FieldLabel>
          <div
            className="mt-2 rounded-xl p-4 text-[15px] leading-relaxed whitespace-pre-wrap"
            style={{ background: BRAND.creamDark, color: BRAND.ink }}
          >
            {clinicalSummary?.trim() ? (
              clinicalSummary
            ) : (
              <span className="italic" style={{ color: BRAND.slateLight }}>
                Aucun résumé clinique fourni.
              </span>
            )}
          </div>
        </div>
      ) : null}

      {showCommercialData ? (
        <div className="border-t px-5 py-5 sm:px-6" style={{ borderColor: BRAND.creamMid }}>
          <FieldLabel>Données commerciales</FieldLabel>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <CommercialDataField
              label="Chirurgien"
              value={assignedSurgeonName ?? 'Non assigné'}
              confirmed={assignedSurgeonName ? true : undefined}
            />
            <CommercialDataField
              label="Budget"
              value={
                quoteAmount != null
                  ? `${quoteAmount.toLocaleString('fr-FR')} €`
                  : 'Non défini'
              }
              confirmed={quoteAmount != null ? quoteAccepted : undefined}
            />
            <CommercialDataField
              label="Date proposée"
              value={
                proposedDate
                  ? new Date(proposedDate).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                  : 'Non définie'
              }
              confirmed={proposedDate ? dateAccepted : undefined}
            />
          </div>
        </div>
      ) : null}
    </section>
  )
}
