import type { ImagingExamRow } from '@/lib/integrations/questionnaire-synthesis-preview.types'
import { SynthesisCard } from '@/components/patient/synthesis/synthesis-card'

type ImagingDossierCardProps = {
  rows: ImagingExamRow[]
  generatedAt: string
  staggerIndex?: number
}

const STATUS_LABEL: Record<ImagingExamRow['status'], string> = {
  pathologique: 'pathologique',
  normal: 'normal',
  surveillance: 'surveillance',
  disponible: 'disponible',
  manquant: 'manquant',
}

const STATUS_CLASS: Record<ImagingExamRow['status'], string> = {
  pathologique: 'bg-danger-soft text-danger-strong border-danger-border',
  normal: 'bg-success-soft text-success-strong border-success-border',
  surveillance: 'bg-warning-soft text-warning-strong border-warning-border',
  disponible: 'bg-info-soft text-info border-info-border',
  manquant: 'bg-neutral-surface-muted text-neutral-text-muted border-neutral-border',
}

export function ImagingDossierCard({ rows, generatedAt, staggerIndex = 0 }: ImagingDossierCardProps) {
  const generatedLabel = new Date(generatedAt).toLocaleDateString('fr-CA', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <SynthesisCard
      title="Dossier patient — Imagerie"
      description={`Synthese generee le ${generatedLabel}`}
      staggerIndex={staggerIndex}
    >
      {rows.length === 0 ? (
        <p className="text-sm italic text-neutral-text-subtle">Aucun examen ou imagerie declaree</p>
      ) : (
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-border/60 text-xs font-semibold uppercase tracking-wide text-neutral-text-muted">
                <th className="pb-3 pr-4">Examen</th>
                <th className="pb-3 pr-4">Date</th>
                <th className="pb-3 pr-4">Resultat</th>
                <th className="pb-3">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-border/40">
              {rows.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="py-3 pr-4 font-semibold text-neutral-text">{row.name}</td>
                  <td className="py-3 pr-4 text-neutral-text-muted">{row.date ?? '—'}</td>
                  <td className="py-3 pr-4 text-neutral-text">{row.result}</td>
                  <td className="py-3">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASS[row.status]}`}
                    >
                      {STATUS_LABEL[row.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SynthesisCard>
  )
}
