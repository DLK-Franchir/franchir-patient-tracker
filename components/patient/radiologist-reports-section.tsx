'use client'

import { useCallback, useEffect, useState } from 'react'
import { RadiologistReportCard, type RadiologistReportView } from '@/components/patient/radiologist-report-card'
import type { ReportSection } from '@/lib/documents/structure-radiologist-report'

type RadiologistReportsSectionProps = {
  patientId: string
  /** Incrémenté par DocumentsSection après un extract réussi. */
  refreshToken?: number
}

type ApiReport = {
  id: string
  document_id: string
  status: 'ok' | 'no_text' | 'error'
  sections: ReportSection[]
  extracted_at: string
  error_code?: string | null
  patient_documents?:
    | { file_name?: string | null; mime_type?: string | null; kind?: string | null }
    | { file_name?: string | null; mime_type?: string | null; kind?: string | null }[]
    | null
}

type ListedDoc = { id: string; url: string; fileName: string }

function nestFileName(row: ApiReport): string | null {
  const rel = row.patient_documents
  if (!rel) return null
  if (Array.isArray(rel)) return rel[0]?.file_name ?? null
  return rel.file_name ?? null
}

export default function RadiologistReportsSection({
  patientId,
  refreshToken = 0,
}: RadiologistReportsSectionProps) {
  const [reports, setReports] = useState<RadiologistReportView[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [reportsRes, docsRes] = await Promise.all([
        fetch(`/api/patients/${patientId}/document-reports`, { cache: 'no-store' }),
        fetch(`/api/patients/${patientId}/documents`, { cache: 'no-store' }),
      ])
      if (!reportsRes.ok) {
        setReports([])
        return
      }
      const reportsJson = (await reportsRes.json()) as { reports?: ApiReport[] }
      const docsJson = docsRes.ok
        ? ((await docsRes.json()) as { documents?: ListedDoc[] })
        : { documents: [] }
      const urlById = new Map((docsJson.documents ?? []).map(d => [d.id, d.url]))

      setReports(
        (reportsJson.reports ?? []).map(row => ({
          id: row.id,
          document_id: row.document_id,
          status: row.status,
          sections: Array.isArray(row.sections) ? row.sections : [],
          extracted_at: row.extracted_at,
          error_code: row.error_code,
          file_name: nestFileName(row),
          source_url: urlById.get(row.document_id) ?? null,
        })),
      )
    } catch {
      setReports([])
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    void load()
  }, [load, refreshToken])

  if (loading && reports.length === 0) {
    return null
  }

  if (reports.length === 0) {
    return null
  }

  return (
    <div className="space-y-4" data-testid="radiologist-reports-section">
      <h2 className="text-xs font-extrabold uppercase tracking-widest text-[#1E2B70]">
        Comptes rendus (extrait)
      </h2>
      {reports.map((report, index) => (
        <RadiologistReportCard key={report.id} report={report} staggerIndex={index} />
      ))}
    </div>
  )
}
