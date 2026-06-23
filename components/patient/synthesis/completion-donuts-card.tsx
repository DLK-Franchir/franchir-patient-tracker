import type { QuestionnaireSynthesisPreview } from '@/lib/integrations/questionnaire-synthesis-preview.types'
import { SynthesisCard } from '@/components/patient/synthesis/synthesis-card'

type CompletionDonutsCardProps = {
  completion: QuestionnaireSynthesisPreview['completion']
  staggerIndex?: number
}

function Donut({ value, label, size = 'md' }: { value: number; label: string; size?: 'md' | 'lg' }) {
  const clamped = Math.min(100, Math.max(0, value))
  const dimension = size === 'lg' ? 'size-24' : 'size-20'
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`${dimension} synthesis-donut rounded-full`}
        style={{
          background: `conic-gradient(var(--color-dash-teal) ${clamped * 3.6}deg, var(--color-neutral-surface-muted) 0deg)`,
        }}
        role="img"
        aria-label={`${label} : ${clamped}%`}
      >
        <div className="m-[6px] flex size-full items-center justify-center rounded-full bg-neutral-surface">
          <span className="text-base font-bold tabular-nums text-neutral-text">{clamped}%</span>
        </div>
      </div>
      <span className="max-w-[7rem] text-center text-xs font-semibold text-neutral-text-muted">{label}</span>
    </div>
  )
}

function statusLabel(status: string): string {
  if (status === 'completed') return 'Dossier complet'
  if (status === 'in_progress') return 'En cours de completion'
  return 'Brouillon'
}

export function CompletionDonutsCard({ completion, staggerIndex = 0 }: CompletionDonutsCardProps) {
  return (
    <SynthesisCard title="Completude" description={statusLabel(completion.status)} staggerIndex={staggerIndex}>
      <div className="flex flex-wrap items-center justify-center gap-6 sm:justify-start">
        <Donut value={completion.overall} label="Questionnaire" size="lg" />
        {completion.sections.map((section) => (
          <Donut key={section.title} value={section.pct} label={section.title} />
        ))}
      </div>
    </SynthesisCard>
  )
}
