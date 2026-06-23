import { SynthesisCard } from '@/components/patient/synthesis/synthesis-card'
import type { AntecedentGroup } from '@/lib/integrations/questionnaire-synthesis-preview.types'

export function AntecedentsCard({
  groups,
  staggerIndex = 0,
}: {
  groups: AntecedentGroup[]
  staggerIndex?: number
}) {
  return (
    <SynthesisCard
      title="Antecedents"
      description={groups.length === 0 ? 'Non renseignes' : `${groups.length} categorie(s)`}
      staggerIndex={staggerIndex}
    >
      {groups.length === 0 ? (
        <p className="text-sm text-neutral-text-muted">Aucun antecedent declare.</p>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <div
              key={group.title}
              className="rounded-xl border border-neutral-border/50 bg-neutral-surface-muted/40 px-4 py-3"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-text-muted">
                {group.title}
              </p>
              <ul className="mt-2 space-y-1">
                {group.items.map((item) => (
                  <li key={item} className="text-sm text-neutral-text">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </SynthesisCard>
  )
}
