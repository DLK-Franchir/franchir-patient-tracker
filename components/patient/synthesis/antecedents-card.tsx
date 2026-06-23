import type { AntecedentGroup } from '@/lib/integrations/questionnaire-synthesis-preview.types'
import { SynthesisCard } from '@/components/patient/synthesis/synthesis-card'

type AntecedentsCardProps = {
  groups: AntecedentGroup[]
  staggerIndex?: number
}

export function AntecedentsCard({ groups, staggerIndex = 0 }: AntecedentsCardProps) {
  return (
    <SynthesisCard title="Antecedents" staggerIndex={staggerIndex}>
      {groups.length === 0 ? (
        <p className="text-sm italic text-neutral-text-subtle">Non renseignes</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map((group) => (
            <div
              key={group.title}
              className="rounded-xl border border-neutral-border/50 bg-neutral-surface-muted/40 px-4 py-3"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-text-muted">
                {group.title}
              </p>
              <ul className="mt-2 space-y-1.5">
                {group.items.map((item) => (
                  <li key={item} className="text-sm font-medium text-neutral-text">
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
