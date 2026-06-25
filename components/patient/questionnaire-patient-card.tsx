'use client'

import { useState } from 'react'
import { Download, FileText } from 'lucide-react'
import type { QuestionnaireStatus } from '@/lib/integrations/questionnaire-portal'
import {
  type QuestionnaireFormType,
  type QuestionnaireFormTypePreset,
  formTypesEqual,
  formTypesForPreset,
  formatFormTypesLabel,
  normalizeFormTypes,
} from '@/lib/integrations/questionnaire-form-types'
import {
  StatusBadge,
  questionnaireStatusLabel,
  questionnaireStatusVariant,
} from '@/components/ui/status-badge'

interface QuestionnairePatientCardProps {
  patientId: string
  patientEmail?: string | null
  questionnaireStatus?: string | null
  questionnaireCompletedAt?: string | null
  questionnaireSummary?: string | null
  bridgeStatus?: QuestionnaireStatus | null
  canManage?: boolean
  initialLanguage?: 'fr' | 'en'
  initialFormTypes?: QuestionnaireFormType[]
  onSendLink: (formTypes: QuestionnaireFormType[], language: 'fr' | 'en') => Promise<void>
  onRevokeLink?: () => Promise<void>
  showPdfDownload?: boolean
}

function formatDateFr(iso: string | null | undefined): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('fr-FR')
}

const SESSION_STATUS_LABEL: Record<string, { label: string; variant: 'success' | 'warning' | 'neutral' }> = {
  draft: { label: 'À démarrer', variant: 'neutral' },
  in_progress: { label: 'En cours', variant: 'warning' },
  completed: { label: 'Complété', variant: 'success' },
}

const PATHOLOGY_BUTTONS: Array<{
  preset: QuestionnaireFormTypePreset
  label: string
  activeClass: string
}> = [
  {
    preset: 'cervical',
    label: 'Cervical',
    activeClass: 'border-blue-500 bg-blue-50 text-blue-700 hover:bg-blue-100',
  },
  {
    preset: 'lombaire',
    label: 'Lombaire',
    activeClass: 'border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
  },
  {
    preset: 'combined',
    label: 'Combiné',
    activeClass: 'border-violet-500 bg-violet-50 text-violet-700 hover:bg-violet-100',
  },
]

function hasInProgressQuestionnaireSession(bridgeStatus?: QuestionnaireStatus | null): boolean {
  return Boolean(
    bridgeStatus?.sessions?.some((s) => s.status === 'in_progress' || s.status === 'draft'),
  )
}

export default function QuestionnairePatientCard({
  patientId,
  patientEmail,
  questionnaireStatus,
  questionnaireCompletedAt,
  questionnaireSummary,
  bridgeStatus,
  canManage = false,
  initialLanguage = 'fr',
  initialFormTypes = ['cervical'],
  onSendLink,
  onRevokeLink,
  showPdfDownload = true,
}: QuestionnairePatientCardProps) {
  const [loading, setLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [language, setLanguage] = useState<'fr' | 'en'>(initialLanguage)

  const statusKey = questionnaireStatus ?? 'draft'
  const latestCompletedSession = bridgeStatus?.sessions?.find((s) => s.status === 'completed')
  const currentFormTypes = normalizeFormTypes(initialFormTypes)

  const handleSendPreset = async (preset: QuestionnaireFormTypePreset) => {
    const targetTypes = formTypesForPreset(preset)

    if (
      !formTypesEqual(currentFormTypes, targetTypes) &&
      hasInProgressQuestionnaireSession(bridgeStatus)
    ) {
      const fromLabel = formatFormTypesLabel(currentFormTypes)
      const toLabel = formatFormTypesLabel(targetTypes)
      const confirmed = window.confirm(
        `Le patient a un questionnaire ${fromLabel} en cours. Passer au parcours ${toLabel} ouvrira une nouvelle session et les réponses en cours seront perdues. Continuer ?`,
      )
      if (!confirmed) return
    }

    setLoading(true)
    try {
      await onSendLink(targetTypes, language)
    } finally {
      setLoading(false)
    }
  }

  const handleRevoke = async () => {
    if (!onRevokeLink) return
    setLoading(true)
    try {
      await onRevokeLink()
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    setPdfLoading(true)
    setPdfError(null)
    try {
      const sessionParam = latestCompletedSession?.id
        ? `?sessionId=${encodeURIComponent(latestCompletedSession.id)}`
        : ''
      const response = await fetch(
        `/api/patients/${patientId}/questionnaire-synthesis-pdf${sessionParam}`,
      )

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Impossible de télécharger la synthèse PDF')
      }

      const blob = await response.blob()
      const disposition = response.headers.get('Content-Disposition') ?? ''
      const filenameMatch = disposition.match(/filename="([^"]+)"/)
      const filename = filenameMatch?.[1] ?? `franchir-synthese-${patientId.slice(0, 8)}.pdf`

      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (downloadError) {
      setPdfError(
        downloadError instanceof Error
          ? downloadError.message
          : 'Erreur lors du téléchargement',
      )
    } finally {
      setPdfLoading(false)
    }
  }

  const sendVerb = questionnaireStatus ? 'Renvoyer' : 'Envoyer'

  return (
    <section className="bg-white border-2 border-gray-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-start gap-3 mb-4">
        <div className="rounded-lg bg-blue-100 p-2.5">
          <FileText className="w-6 h-6 text-[#2563EB]" aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-gray-900">Questionnaire patient</h3>
          <p className="text-sm text-gray-600 mt-1">
            Lien patient, suivi et synthèse PDF (scores, drapeaux rouges, imagerie).
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge
          label={questionnaireStatusLabel(statusKey)}
          variant={questionnaireStatusVariant(statusKey)}
          size="lg"
        />
        {questionnaireCompletedAt && (
          <span className="text-sm font-medium text-gray-600">
            Complété le {formatDateFr(questionnaireCompletedAt)}
          </span>
        )}
      </div>

      {patientEmail && (
        <p className="text-sm text-gray-500 mt-3 break-all">
          Patient : <span className="font-medium text-gray-700">{patientEmail}</span>
        </p>
      )}

      <p className="text-sm text-gray-600 mt-2">
        Parcours configuré :{' '}
        <span className="font-semibold text-gray-800">{formatFormTypesLabel(currentFormTypes)}</span>
      </p>

      {statusKey === 'completed' && questionnaireSummary && (
        <p className="text-sm text-gray-700 mt-3 whitespace-pre-line border-t border-gray-100 pt-3 bg-gray-50 rounded-lg p-3">
          {questionnaireSummary}
        </p>
      )}

      {showPdfDownload && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={handleDownload}
            disabled={pdfLoading || statusKey !== 'completed'}
            className="inline-flex items-center gap-2 w-full justify-center px-4 py-3 text-base font-semibold rounded-lg bg-[#2563EB] text-white hover:bg-[#1d4ed8] disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <Download className="w-5 h-5" aria-hidden />
            {pdfLoading ? 'Génération…' : 'Télécharger la synthèse PDF'}
          </button>
          {statusKey !== 'completed' && (
            <p className="mt-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              La synthèse PDF est disponible une fois le questionnaire complété par le patient.
            </p>
          )}
          {pdfError && (
            <p className="mt-2 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {pdfError}
            </p>
          )}
        </div>
      )}

      {canManage && (
        statusKey === 'completed' ? (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <p className="text-sm text-gray-700 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
              Questionnaire complété — pour une nouvelle évaluation, créez un nouveau dossier patient.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
            <div>
              <p className="text-sm font-semibold text-gray-800 mb-2">Langue du questionnaire</p>
              <div className="flex gap-2">
                {(['fr', 'en'] as const).map((lang) => {
                  const active = language === lang
                  return (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setLanguage(lang)}
                      disabled={loading}
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
            <div>
              <p className="text-sm font-semibold text-gray-800 mb-2">Pathologie du questionnaire</p>
              <p className="text-xs text-gray-500 mb-3">
                Choisissez le parcours à envoyer. Un changement de pathologie avec questionnaire en cours
                ouvre une nouvelle session.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {PATHOLOGY_BUTTONS.map(({ preset, label, activeClass }) => {
                  const targetTypes = formTypesForPreset(preset)
                  const isCurrent = formTypesEqual(currentFormTypes, targetTypes)
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleSendPreset(preset)}
                      disabled={loading}
                      className={`text-sm font-bold px-3 py-3 rounded-lg border-2 transition disabled:opacity-50 ${
                        isCurrent
                          ? activeClass
                          : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50'
                      }`}
                    >
                      {loading ? 'Envoi…' : `${sendVerb} ${label}`}
                    </button>
                  )
                })}
              </div>
            </div>
            {bridgeStatus?.activeLink && onRevokeLink && (
              <button
                type="button"
                onClick={handleRevoke}
                disabled={loading}
                className="w-full text-sm font-medium text-red-700 hover:text-red-800 hover:bg-red-50 px-3 py-2 rounded-lg border border-red-200 disabled:opacity-50 transition"
              >
                Révoquer le lien actif
              </button>
            )}
          </div>
        )
      )}

      {bridgeStatus?.activeLink && (
        <div className="mt-4 border-t border-gray-100 pt-3 space-y-1 text-sm text-gray-600">
          {formatDateFr(bridgeStatus.activeLink.expiresAt) && (
            <p>Expire le {formatDateFr(bridgeStatus.activeLink.expiresAt)}</p>
          )}
          {!bridgeStatus.activeLink.sentAt && statusKey !== 'completed' && (
            <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Lien actif mais email non confirmé — renvoyez le lien et vérifiez l&apos;adresse
              patient{patientEmail ? ` (${patientEmail})` : ''}.
            </p>
          )}
          {formatDateFr(bridgeStatus.activeLink.sentAt) && (
            <p>Envoyé le {formatDateFr(bridgeStatus.activeLink.sentAt)}</p>
          )}
          {formatDateFr(bridgeStatus.activeLink.openedAt) && (
            <p className="text-blue-700 font-medium">Ouvert le {formatDateFr(bridgeStatus.activeLink.openedAt)}</p>
          )}
          {formatDateFr(bridgeStatus.activeLink.completedAt) && (
            <p className="text-green-700 font-medium">Complété le {formatDateFr(bridgeStatus.activeLink.completedAt)}</p>
          )}
        </div>
      )}

      {bridgeStatus?.sessions && bridgeStatus.sessions.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <p className="text-sm font-bold text-gray-800 mb-3">Suivi longitudinal</p>
          <ul className="space-y-2">
            {bridgeStatus.sessions.map((s) => {
              const cfg = SESSION_STATUS_LABEL[s.status] ?? SESSION_STATUS_LABEL.draft
              return (
                <li key={s.id} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-gray-700 truncate">
                    {s.label}
                    {s.isActive && <span className="ml-1 text-xs font-bold text-blue-600">(actif)</span>}
                    <span className="block text-xs text-gray-400">
                      {formatDateFr(s.createdAt)}
                      {s.completedAt && ` · complété ${formatDateFr(s.completedAt)}`}
                    </span>
                  </span>
                  <StatusBadge label={cfg.label} variant={cfg.variant} size="sm" />
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
