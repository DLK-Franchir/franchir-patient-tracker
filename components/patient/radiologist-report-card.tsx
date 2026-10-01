'use client'

import { FileText, ExternalLink, AlertCircle } from 'lucide-react'
import { SynthesisCard } from '@/components/patient/synthesis/synthesis-card'
import {
  reportExtractErrorMessage,
  type ReportSection,
} from '@/lib/documents/structure-radiologist-report'

export type RadiologistReportView = {
  id: string
  document_id: string
  status: 'ok' | 'no_text' | 'error'
  sections: ReportSection[]
  extracted_at: string
  error_code?: string | null
  file_name?: string | null
  source_url?: string | null
}

type RadiologistReportCardProps = {
  report: RadiologistReportView
  staggerIndex?: number
}

export function RadiologistReportCard({ report, staggerIndex = 0 }: RadiologistReportCardProps) {
  const title = report.file_name
    ? `Compte rendu — ${report.file_name}`
    : 'Compte rendu radiologue'

  return (
    <SynthesisCard
      title={title}
      description="Phrases extraites du PDF uniquement — aucune interprétation ajoutée"
      staggerIndex={staggerIndex}
      actions={
        report.source_url ? (
          <a
            href={report.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-border px-3 py-1.5 text-xs font-medium text-neutral-text transition hover:bg-neutral-surface-muted"
            data-testid="radiologist-report-source-link"
          >
            <ExternalLink className="size-3.5" aria-hidden />
            Voir le PDF source
          </a>
        ) : null
      }
    >
      {report.status === 'no_text' ? (
        <div
          className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          data-testid="radiologist-report-no-text"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{reportExtractErrorMessage('no_text_layer')}</p>
        </div>
      ) : null}

      {report.status === 'error' ? (
        <div
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          data-testid="radiologist-report-error"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{reportExtractErrorMessage(report.error_code)}</p>
        </div>
      ) : null}

      {report.status === 'ok' ? (
        <div className="space-y-4" data-testid="radiologist-report-sections">
          {report.sections.map(section => (
            <div key={section.id}>
              <h4 className="text-sm font-semibold text-neutral-text">{section.title}</h4>
              <p
                className={`mt-1 whitespace-pre-wrap text-sm leading-relaxed ${
                  section.present ? 'text-neutral-text' : 'italic text-neutral-text-muted'
                }`}
              >
                {section.text}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <p className="mt-4 flex items-center gap-1.5 text-[11px] text-neutral-text-muted">
        <FileText className="size-3" aria-hidden />
        Extrait du document, sans interprétation clinique
      </p>
    </SynthesisCard>
  )
}
