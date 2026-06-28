import { SynthesisCard } from '@/components/patient/synthesis/synthesis-card'
import { OrientationFieldGrid } from '@franchir/synthesis-contract'
import type { OrientationSummaryField } from '@/lib/integrations/questionnaire-synthesis-preview.types'

type OrientationCliniqueCardProps = {
  fields: OrientationSummaryField[]
  spineRegionLabel?: string
  staggerIndex?: number
}

export function OrientationCliniqueCard({
  fields,
  spineRegionLabel,
  staggerIndex = 0,
}: OrientationCliniqueCardProps) {
  return (
    <SynthesisCard title="Orientation clinique" staggerIndex={staggerIndex}>
      {spineRegionLabel ? (
        <p className="mb-4 inline-flex rounded-lg border border-brand/30 bg-brand/5 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand">
          Parcours {spineRegionLabel}
        </p>
      ) : null}
      <OrientationFieldGrid
        fields={fields}
        emptyMessage="Aucun élément d'orientation renseigné."
      />
    </SynthesisCard>
  )
}
