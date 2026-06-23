import { SynthesisCard } from '@/components/patient/synthesis/synthesis-card'
import type { TreatmentItem } from '@/lib/integrations/questionnaire-synthesis-preview.types'

export function TreatmentsCard({
  items,
  staggerIndex = 0,
}: {
  items: TreatmentItem[]
  staggerIndex?: number
}) {
  return (
    <SynthesisCard
      title="Traitements"
      description={items.length === 0 ? 'Non renseignes' : `${items.length} entree(s)`}
      staggerIndex={staggerIndex}
    >
      {items.length === 0 ? (
        <p className="text-sm text-neutral-text-muted">Aucun traitement declare.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={`${item.name}-${item.detail ?? ''}`}
              className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-neutral-border/50 bg-neutral-surface-muted/30 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-text">{item.name}</p>
                {item.detail ? (
                  <p className="mt-0.5 text-sm text-neutral-text-muted">{item.detail}</p>
                ) : null}
              </div>
              {item.status ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    item.status === 'actif'
                      ? 'bg-info-soft text-info border border-info-border'
                      : 'bg-neutral-surface-muted text-neutral-text-muted'
                  }`}
                >
                  {item.status === 'actif' ? 'Actif' : 'Historique'}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </SynthesisCard>
  )
}
