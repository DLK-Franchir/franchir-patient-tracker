import { SynthesisCard } from '@/components/patient/synthesis/synthesis-card'
import { FunctionalScoreBars } from '@franchir/synthesis-contract'
import type { QuestionnaireSynthesisPreview } from '@/lib/integrations/questionnaire-synthesis-preview.types'

export function FunctionalScoresCard({
  scores,
  staggerIndex = 0,
}: {
  scores: QuestionnaireSynthesisPreview['scores']
  staggerIndex?: number
}) {
  return (
    <SynthesisCard title="Scores fonctionnels" staggerIndex={staggerIndex}>
      <FunctionalScoreBars rows={scores.rows ?? []} theme="tracker" />
    </SynthesisCard>
  )
}
