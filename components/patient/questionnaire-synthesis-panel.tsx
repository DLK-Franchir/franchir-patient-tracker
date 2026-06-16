'use client'

import { useState } from 'react'
import { Download, FileText } from 'lucide-react'
import type { QuestionnaireStatus } from '@/lib/integrations/questionnaire-portal'

type BridgeSession = NonNullable<QuestionnaireStatus['sessions']>[number]

interface QuestionnaireSynthesisPanelProps {
  patientId: string
  questionnaireStatus?: string | null
  questionnaireCompletedAt?: string | null
  bridgeSessions?: BridgeSession[] | null
}

function formatDateFr(iso: string | null | undefined): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('fr-FR')
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  completed: { label: 'Complété', cls: 'bg-green-100 text-green-800' },
  sent: { label: 'En cours', cls: 'bg-blue-100 text-blue-800' },
  draft: { label: 'Non démarré', cls: 'bg-slate-100 text-slate-600' },
}

export default function QuestionnaireSynthesisPanel({
  patientId,
  questionnaireStatus,
  questionnaireCompletedAt,
  bridgeSessions,
}: QuestionnaireSynthesisPanelProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const statusKey = questionnaireStatus ?? 'draft'
  const statusCfg = STATUS_LABEL[statusKey] ?? STATUS_LABEL.draft
  const latestCompletedSession = bridgeSessions?.find((s) => s.status === 'completed')

  const handleDownload = async () => {
    setLoading(true)
    setError(null)
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
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : 'Erreur lors du téléchargement',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-blue-50 p-2">
          <FileText className="w-5 h-5 text-[#2563EB]" aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900">Synthèse questionnaire</h3>
          <p className="text-xs text-gray-500 mt-1">
            Rapport médical PDF (scores, drapeaux rouges, imagerie).
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.cls}`}
            >
              {statusCfg.label}
            </span>
            {questionnaireCompletedAt && (
              <span className="text-xs text-gray-500">
                Complété le {formatDateFr(questionnaireCompletedAt)}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleDownload}
            disabled={loading || statusKey !== 'completed'}
            className="mt-3 inline-flex items-center gap-2 w-full justify-center px-3 py-2 text-sm font-medium rounded-md bg-[#2563EB] text-white hover:bg-[#1d4ed8] disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <Download className="w-4 h-4" aria-hidden />
            {loading ? 'Génération…' : 'Télécharger la synthèse PDF'}
          </button>

          {statusKey !== 'completed' && (
            <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
              La synthèse PDF est disponible une fois le questionnaire complété par le patient.
            </p>
          )}

          {error && (
            <p className="mt-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded-md px-3 py-2">
              {error}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
