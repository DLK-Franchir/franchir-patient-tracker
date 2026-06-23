'use client'

import { useCallback, useState } from 'react'
import { FileText, RefreshCw } from 'lucide-react'
import type { QuestionnaireSynthesisPreview } from '@/lib/integrations/questionnaire-synthesis-preview.types'
import { AnamnezeDashboard } from '@/components/patient/synthesis/anamneze-dashboard'

type AnamnezeSectionProps = {
  patientId: string
  patientName: string
  questionnaireStatus?: string | null
  initialPreview: QuestionnaireSynthesisPreview | null
  initialError?: string | null
  sessionId?: string | null
}

export default function AnamnezeSection({
  patientId,
  patientName,
  questionnaireStatus,
  initialPreview,
  initialError = null,
  sessionId,
}: AnamnezeSectionProps) {
  const [preview, setPreview] = useState<QuestionnaireSynthesisPreview | null>(initialPreview)
  const [error, setError] = useState<string | null>(initialError)
  const [loading, setLoading] = useState(false)

  const isCompleted = questionnaireStatus === 'completed'

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ''
      const res = await fetch(`/api/patients/${patientId}/questionnaire-synthesis-preview${params}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'Impossible de charger la synthese')
      }
      setPreview(data as QuestionnaireSynthesisPreview)
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [patientId, sessionId])

  return (
    <section className="overflow-hidden rounded-xl border border-neutral-border/60 shadow-[var(--dash-shadow-card)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-border/50 bg-neutral-surface px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <div className="rounded-lg bg-info-soft p-2.5">
            <FileText className="size-6 text-info" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-neutral-text sm:text-xl">Synthese Anamneze</h2>
            <p className="mt-0.5 text-sm text-neutral-text-muted">
              Apercu clinique du questionnaire patient — scores, drapeaux et imagerie.
            </p>
          </div>
        </div>
        {isCompleted && (
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-border bg-neutral-surface px-4 py-2 text-sm font-semibold text-neutral-text transition hover:bg-neutral-surface-muted disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            {loading ? 'Chargement…' : 'Actualiser'}
          </button>
        )}
      </div>

      <div className="bg-dash-bg p-0">
        {!isCompleted ? (
          <div className="px-4 py-8 text-center sm:px-6">
            <p className="text-sm text-neutral-text-muted">
              La synthese Anamneze sera disponible une fois le questionnaire complete par le patient.
            </p>
          </div>
        ) : error && !preview ? (
          <div className="space-y-4 px-4 py-8 sm:px-6">
            <p className="rounded-xl border border-warning-border bg-warning-soft px-4 py-3 text-sm text-warning-strong">
              {error}
            </p>
            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-50"
            >
              Reessayer
            </button>
          </div>
        ) : preview ? (
          <AnamnezeDashboard patientName={patientName} preview={preview} />
        ) : (
          <div className="flex items-center justify-center py-12">
            <div className="size-8 animate-spin rounded-full border-4 border-neutral-border border-t-brand" />
          </div>
        )}
      </div>
    </section>
  )
}
