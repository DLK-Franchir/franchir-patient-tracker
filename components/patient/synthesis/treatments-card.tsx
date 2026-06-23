import type { TreatmentItem } from '@/lib/integrations/questionnaire-synthesis-preview.types'
import { SynthesisCard } from '@/components/patient/synthesis/synthesis-card'

type TreatmentsCardProps = {
  items: TreatmentItem[]
  staggerIndex?: number
}

export function TreatmentsCard({ items, staggerIndex = 0 }: TreatmentsCardProps) {
  return (
    <SynthesisCard title="Traitements en cours" staggerIndex={staggerIndex}>
      {items.length === 0 ? (
        <p className="text-sm italic text-neutral-text-subtle">Aucun traitement renseigne</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item, idx) => (
            <li
              key={`${item.name}-${idx}`}
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
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    item.status === 'actif'
                      ? 'bg-dash-teal/15 text-dash-charcoal'
                      : 'bg-neutral-surface-muted text-neutral-text-muted'
                  }`}
                >
                  {item.status === 'actif' ? 'actif' : 'historique'}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </SynthesisCard>
  )
}
