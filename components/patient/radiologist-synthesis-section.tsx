'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FileText, RefreshCw, AlertCircle, ExternalLink, Loader2 } from 'lucide-react'
import type { RadiologistSynthesis } from '@/lib/documents/synthesize-radiologist-report'
import { reportExtractErrorMessage } from '@/lib/documents/structure-radiologist-report'

type ReportRow = {
  id: string
  document_id: string
  status: 'ok' | 'no_text' | 'error'
  synthesis_status?: 'pending' | 'ok' | 'error' | 'skipped' | null
  synthesis?: RadiologistSynthesis | null
  error_code?: string | null
  synthesized_at?: string | null
  extracted_at?: string
  patient_documents?:
    | { file_name?: string | null; series_description?: string | null; mime_type?: string | null; kind?: string | null }
    | { file_name?: string | null; series_description?: string | null }[]
    | null
}

type ListedDoc = { id: string; url: string; fileName: string }

type DocRel = { file_name?: string | null; series_description?: string | null }

function nestDoc(row: ReportRow): DocRel | null {
  const rel = row.patient_documents
  if (!rel) return null
  if (Array.isArray(rel)) return rel[0] ?? null
  return rel
}

function fileNameOf(row: ReportRow): string {
  const doc = nestDoc(row)
  const series = doc?.series_description?.trim()
  if (series) return series
  return doc?.file_name?.trim() || 'Compte rendu'
}

type RadiologistSynthesisSectionProps = {
  patientId: string
}

/**
 * Bloc synthèse CR — même chrome que Synthèse Anamneze, au-dessus de l’imagerie.
 * Déclenchement automatique à l’ouverture du dossier (pas de bouton obligatoire).
 */
export default function RadiologistSynthesisSection({ patientId }: RadiologistSynthesisSectionProps) {
  const [reports, setReports] = useState<ReportRow[]>([])
  const [urlById, setUrlById] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [remaining, setRemaining] = useState(0)
  const booted = useRef(false)

  const applyReports = useCallback((rows: ReportRow[]) => {
    setReports(
      rows.filter(
        r =>
          r.synthesis_status === 'ok' ||
          r.status === 'no_text' ||
          r.status === 'error' ||
          r.synthesis_status === 'error',
      ),
    )
  }, [])

  const loadUrls = useCallback(async () => {
    try {
      const res = await fetch(`/api/patients/${patientId}/documents`, { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as { documents?: ListedDoc[] }
      setUrlById(new Map((data.documents ?? []).map(d => [d.id, d.url])))
    } catch {
      /* ignore */
    }
  }, [patientId])

  const autoSynthesize = useCallback(
    async (force = false) => {
      setBusy(true)
      setError(null)
      try {
        let guard = 0
        let more = true
        while (more && guard < 8) {
          guard += 1
          const res = await fetch(`/api/patients/${patientId}/document-reports/auto-synthesize`, {
            method: 'POST',
            headers: force && guard === 1 ? { 'x-franchir-force': '1' } : undefined,
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) {
            throw new Error(data.error || 'Synthèse impossible')
          }
          applyReports((data.reports ?? []) as ReportRow[])
          const left = Number(data.remaining ?? 0)
          setRemaining(left)
          more = left > 0
          force = false
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur de synthèse')
      } finally {
        setBusy(false)
        setLoading(false)
      }
    },
    [patientId, applyReports],
  )

  useEffect(() => {
    if (booted.current) return
    booted.current = true
    void loadUrls()
    void autoSynthesize(false)
  }, [autoSynthesize, loadUrls])

  const withSynthesis = reports.filter(r => r.synthesis_status === 'ok' && r.synthesis)
  const problems = reports.filter(
    r => r.status === 'no_text' || r.status === 'error' || r.synthesis_status === 'error',
  )

  return (
    <section
      className="overflow-hidden rounded-xl border border-neutral-border/60 shadow-[var(--dash-shadow-card)]"
      data-testid="radiologist-synthesis-section"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-border/50 bg-neutral-surface px-4 py-5 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <div className="rounded-lg bg-[#1E2B70]/10 p-2.5">
            <FileText className="size-7 text-[#1E2B70]" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-extrabold tracking-tight text-neutral-text sm:text-2xl">
              Synthèse des comptes rendus
            </h2>
            <p className="mt-1 text-sm text-neutral-text-muted">
              Lecture automatique des PDF / DOC radiologues — points clés pour le clinicien, sans
              interprétation ajoutée.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void autoSynthesize(true)}
          disabled={busy}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-border bg-neutral-surface px-4 py-2 text-sm font-semibold text-neutral-text transition hover:bg-neutral-surface-muted disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="size-4" aria-hidden />
          )}
          {busy ? 'Synthèse en cours…' : 'Actualiser'}
        </button>
      </div>

      <div className="space-y-4 bg-dash-bg p-4 sm:p-6">
        {loading || (busy && withSynthesis.length === 0 && problems.length === 0) ? (
          <div
            className="flex items-center gap-3 rounded-xl border border-neutral-border/50 bg-neutral-surface px-4 py-6 text-sm text-neutral-text-muted"
            data-testid="radiologist-synthesis-loading"
          >
            <Loader2 className="size-5 animate-spin text-[#1E2B70]" aria-hidden />
            Analyse automatique des comptes rendus du dossier…
          </div>
        ) : null}

        {error ? (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </div>
        ) : null}

        {!loading && !busy && withSynthesis.length === 0 && problems.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-border bg-neutral-surface px-4 py-6 text-center text-sm text-neutral-text-muted">
            Aucun compte rendu radiologue détecté dans ce dossier (PDF ou DOC). Les questionnaires
            patients sont exclus.
          </p>
        ) : null}

        {withSynthesis.map(row => {
          const s = row.synthesis!
          const sourceUrl = urlById.get(row.document_id)
          return (
            <article
              key={row.id}
              className="rounded-[var(--dash-radius-card)] border border-neutral-border/60 bg-neutral-surface shadow-[var(--dash-shadow-card)]"
              data-testid="radiologist-synthesis-card"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-border/50 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#1E2B70]">
                    {fileNameOf(row)}
                  </p>
                  <h3 className="mt-1 text-lg font-bold leading-snug text-neutral-text sm:text-xl">
                    {s.headline}
                  </h3>
                </div>
                {sourceUrl ? (
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-border px-3 py-1.5 text-xs font-medium text-neutral-text transition hover:bg-neutral-surface-muted"
                  >
                    <ExternalLink className="size-3.5" aria-hidden />
                    PDF source
                  </a>
                ) : null}
              </div>
              <div className="space-y-4 p-5">
                {s.context ? (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wide text-neutral-text-muted">
                      Contexte
                    </h4>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-neutral-text">
                      {s.context}
                    </p>
                  </div>
                ) : null}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wide text-neutral-text-muted">
                    Points clés
                  </h4>
                  <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-neutral-text">
                    {s.keyFindings.map(item => (
                      <li key={item.slice(0, 48)}>{item}</li>
                    ))}
                  </ul>
                </div>
                {s.conclusion ? (
                  <div className="rounded-lg border border-[#1E2B70]/15 bg-[#1E2B70]/5 px-4 py-3">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-[#1E2B70]">
                      Conclusion
                    </h4>
                    <p className="mt-1 text-sm font-medium leading-relaxed text-neutral-text">
                      {s.conclusion}
                    </p>
                  </div>
                ) : null}
                {s.absentNotes?.length ? (
                  <p className="text-[11px] italic text-neutral-text-muted">
                    {s.absentNotes.join(' · ')}
                  </p>
                ) : null}
                <p className="text-[11px] text-neutral-text-muted">
                  Synthèse ancrée au document — aucune interprétation clinique ajoutée.
                </p>
              </div>
            </article>
          )
        })}

        {problems.map(row => (
          <div
            key={row.id}
            className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div>
              <p className="font-semibold">{fileNameOf(row)}</p>
              <p className="mt-0.5">
                {reportExtractErrorMessage(row.error_code ?? (row.status === 'no_text' ? 'no_text_layer' : null))}
              </p>
            </div>
          </div>
        ))}

        {remaining > 0 && busy ? (
          <p className="text-center text-xs text-neutral-text-muted">
            {remaining} compte rendu{remaining > 1 ? 's' : ''} restant{remaining > 1 ? 's' : ''}…
          </p>
        ) : null}
      </div>
    </section>
  )
}
