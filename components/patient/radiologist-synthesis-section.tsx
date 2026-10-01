'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FileText, RefreshCw, AlertCircle, ExternalLink, Loader2 } from 'lucide-react'
import type { RadiologistSynthesis } from '@/lib/documents/synthesize-radiologist-report'
import { reportExtractErrorMessage } from '@/lib/documents/structure-radiologist-report'
import {
  isRadiologistReportCandidate,
  reportNeedsFreshSynthesis,
} from '@/lib/documents/report-candidates'
import { isLikelyReportName, REPORT_READ_REV } from '@/lib/documents/report-triage'
import { extractReportTextFromFile } from '@/lib/documents/extract-report-text'

type ReportRow = {
  id: string
  document_id: string
  status: 'ok' | 'no_text' | 'error'
  synthesis_status?: 'pending' | 'ok' | 'error' | 'skipped' | null
  synthesis?: RadiologistSynthesis | null
  error_code?: string | null
  synthesis_model?: string | null
  synthesized_at?: string | null
  extracted_at?: string
  patient_documents?:
    | {
        file_name?: string | null
        series_description?: string | null
        mime_type?: string | null
        kind?: string | null
        modality?: string | null
      }
    | {
        file_name?: string | null
        series_description?: string | null
        mime_type?: string | null
        kind?: string | null
        modality?: string | null
      }[]
    | null
}

type ListedDoc = {
  id: string
  url: string
  fileName: string
  mimeType: string | null
  kind: string
  modality: string | null
  seriesDescription: string | null
  renderType: string
}

type DocRel = { file_name?: string | null; series_description?: string | null }

function nestDoc(row: ReportRow): DocRel | null {
  const rel = row.patient_documents
  if (!rel) return null
  if (Array.isArray(rel)) return rel[0] ?? null
  return rel
}

function labelOf(doc: ListedDoc | undefined, row?: ReportRow): string {
  const series = doc?.seriesDescription?.trim() || nestDoc(row ?? ({} as ReportRow))?.series_description?.trim()
  if (series) return series
  const file = doc?.fileName?.trim() || nestDoc(row ?? ({} as ReportRow))?.file_name?.trim()
  return file || 'Compte rendu'
}

type RadiologistSynthesisSectionProps = {
  patientId: string
}

const MAX_PER_OPEN = 6

/**
 * Synthèse CR au-dessus de l’imagerie.
 * Le PDF est lu dans le navigateur (polices + mêmes octets que la visionneuse),
 * puis le texte seul est envoyé pour structuration. Les artefacts de CD sont ignorés.
 */
export default function RadiologistSynthesisSection({ patientId }: RadiologistSynthesisSectionProps) {
  const [reports, setReports] = useState<ReportRow[]>([])
  const [candidates, setCandidates] = useState<ListedDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [statusLine, setStatusLine] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [remaining, setRemaining] = useState(0)
  const booted = useRef(false)
  const runId = useRef(0)

  const upsertRow = useCallback((row: ReportRow) => {
    setReports(prev => {
      const rest = prev.filter(r => r.document_id !== row.document_id)
      return [...rest, row]
    })
  }, [])

  const loadBundle = useCallback(async () => {
    const [docsRes, reportsRes] = await Promise.all([
      fetch(`/api/patients/${patientId}/documents`, { cache: 'no-store' }),
      fetch(`/api/patients/${patientId}/document-reports`, { cache: 'no-store' }),
    ])
    if (!docsRes.ok) throw new Error('Liste des documents indisponible')
    const docsJson = (await docsRes.json()) as { documents?: ListedDoc[] }
    const nextCandidates = (docsJson.documents ?? []).filter(doc =>
      isRadiologistReportCandidate({
        fileName: doc.fileName,
        kind: doc.kind,
        mimeType: doc.mimeType,
        modality: doc.modality,
        seriesDescription: doc.seriesDescription,
        renderType: doc.renderType,
      }),
    )
    const reportsJson = reportsRes.ok
      ? ((await reportsRes.json()) as { reports?: ReportRow[] })
      : { reports: [] }
    const allowed = new Set(nextCandidates.map(d => d.id))
    setCandidates(nextCandidates)
    setReports((reportsJson.reports ?? []).filter(r => allowed.has(r.document_id)))
    return { nextCandidates, rows: (reportsJson.reports ?? []).filter(r => allowed.has(r.document_id)) }
  }, [patientId])

  const readOne = useCallback(
    async (doc: ListedDoc): Promise<void> => {
      setStatusLine(`Lecture de ${labelOf(doc)}…`)
      let posted = false
      try {
        const fileRes = await fetch(doc.url)
        if (fileRes.ok) {
          const bytes = new Uint8Array(await fileRes.arrayBuffer())
          const extracted = await extractReportTextFromFile(bytes, {
            kind: doc.kind,
            fileName: doc.fileName,
            mimeType: doc.mimeType,
          })
          if (extracted.ok) {
            const res = await fetch(`/api/patients/${patientId}/document-reports/from-text`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ documentId: doc.id, text: extracted.text }),
            })
            const data = (await res.json().catch(() => ({}))) as { report?: ReportRow; error?: string }
            if (!res.ok || !data.report) throw new Error(data.error || 'Synthèse impossible')
            upsertRow(data.report)
            posted = true
          }
        }
      } catch {
        posted = false
      }
      if (posted) return

      const fallback = await fetch(
        `/api/patients/${patientId}/documents/${doc.id}/report-extract`,
        { method: 'POST' },
      )
      const data = (await fallback.json().catch(() => ({}))) as { report?: ReportRow; error?: string }
      if (!fallback.ok || !data.report) {
        throw new Error(data.error || 'Lecture du compte rendu impossible')
      }
      upsertRow(data.report)
    },
    [patientId, upsertRow],
  )

  const run = useCallback(
    async (force: boolean) => {
      const token = ++runId.current
      setBusy(true)
      setError(null)
      setStatusLine(null)
      try {
        const { nextCandidates, rows } = await loadBundle()
        if (token !== runId.current) return
        setLoading(false)
        const byDoc = new Map(rows.map(r => [r.document_id, r]))
        const todo = nextCandidates.filter(doc => reportNeedsFreshSynthesis(byDoc.get(doc.id), force))
        const batch = todo.slice(0, MAX_PER_OPEN)
        setRemaining(Math.max(0, todo.length - batch.length))
        if (batch.length === 0) {
          setLoading(false)
          setBusy(false)
          return
        }
        for (const doc of batch) {
          if (token !== runId.current) return
          try {
            await readOne(doc)
          } catch (e) {
            if (token !== runId.current) return
            setError(e instanceof Error ? e.message : 'Erreur de synthèse')
          }
        }
        if (token !== runId.current) return
        setRemaining(Math.max(0, todo.length - batch.length))
      } catch (e) {
        if (token !== runId.current) return
        setError(e instanceof Error ? e.message : 'Erreur de synthèse')
      } finally {
        if (token === runId.current) {
          setBusy(false)
          setLoading(false)
          setStatusLine(null)
        }
      }
    },
    [loadBundle, readOne],
  )

  useEffect(() => {
    if (booted.current) return
    booted.current = true
    void run(false)
  }, [run])

  const docById = new Map(candidates.map(d => [d.id, d]))
  const freshSynthesis = (row: ReportRow) => (row.synthesis_model ?? '').includes(REPORT_READ_REV)
  const withSynthesis = reports.filter(
    r => r.synthesis_status === 'ok' && r.synthesis && r.error_code !== 'off_topic' && freshSynthesis(r),
  )
  const problems = reports.filter(r => {
    if (r.error_code === 'off_topic' || r.synthesis_status === 'ok') return false
    if (!docById.has(r.document_id)) return false
    const label = labelOf(docById.get(r.document_id), r)
    if (!isLikelyReportName(label)) return false
    return r.status === 'no_text' || r.status === 'error' || r.synthesis_status === 'error'
  })

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
              Lecture automatique des comptes rendus radiologues — points clés pour le clinicien,
              sans interprétation ajoutée.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void run(true)}
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
        {loading || (busy && withSynthesis.length === 0) ? (
          <div
            className="flex items-center gap-3 rounded-xl border border-neutral-border/50 bg-neutral-surface px-4 py-6 text-sm text-neutral-text-muted"
            data-testid="radiologist-synthesis-loading"
          >
            <Loader2 className="size-5 animate-spin text-[#1E2B70]" aria-hidden />
            {statusLine ?? 'Analyse automatique des comptes rendus du dossier…'}
          </div>
        ) : null}

        {busy && withSynthesis.length > 0 && statusLine ? (
          <p className="text-xs text-neutral-text-muted">{statusLine}</p>
        ) : null}

        {error ? (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </div>
        ) : null}

        {!loading && !busy && withSynthesis.length === 0 && problems.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-border bg-neutral-surface px-4 py-6 text-center text-sm text-neutral-text-muted">
            Aucun compte rendu médical textuel dans ce dossier. Les PDF techniques, les pages
            de garde et les images sans texte restent dans Imagerie.
          </p>
        ) : null}

        {withSynthesis.map(row => {
          const s = row.synthesis!
          const doc = docById.get(row.document_id)
          const sourceUrl = doc?.url
          return (
            <article
              key={row.id}
              className="rounded-[var(--dash-radius-card)] border border-neutral-border/60 bg-neutral-surface shadow-[var(--dash-shadow-card)]"
              data-testid="radiologist-synthesis-card"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-border/50 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#1E2B70]">
                    {labelOf(doc, row)}
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
                    {s.keyFindings.map((item, index) => (
                      <li key={`${row.id}-${index}`}>{item}</li>
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

        {!busy
          ? problems.map(row => (
              <div
                key={row.id}
                className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <div>
                  <p className="font-semibold">{labelOf(docById.get(row.document_id), row)}</p>
                  <p className="mt-0.5">
                    {reportExtractErrorMessage(
                      row.error_code ?? (row.status === 'no_text' ? 'no_text_layer' : null),
                    )}
                  </p>
                </div>
              </div>
            ))
          : null}

        {remaining > 0 && !busy ? (
          <p className="text-center text-xs text-neutral-text-muted">
            {remaining} compte rendu{remaining > 1 ? 's' : ''} encore à lire — Actualiser pour
            continuer.
          </p>
        ) : null}
      </div>
    </section>
  )
}
