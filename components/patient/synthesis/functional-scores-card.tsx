import { SynthesisCard } from '@/components/patient/synthesis/synthesis-card'
import type { QuestionnaireSynthesisPreview } from '@/lib/integrations/questionnaire-synthesis-preview.types'

function ScoreBar({
  label,
  value,
  max,
  interpretation,
  severityClass,
}: {
  label: string
  value: number | null
  max: number
  interpretation: string
  severityClass: string
}) {
  const pct = value !== null ? Math.round((value / max) * 100) : 0
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-neutral-text">{label}</span>
        <span className="text-sm text-neutral-text-muted">
          {value !== null ? `${value}/${max}` : '—'} · {interpretation}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-neutral-surface-muted">
        <div
          className={`synthesis-bar-animate h-full rounded-full ${severityClass}`}
          style={{ width: value !== null ? `${pct}%` : '0%' }}
        />
      </div>
    </div>
  )
}

function ndiSeverityClass(pct: number | null): string {
  if (pct === null) return 'bg-neutral-text-subtle'
  if (pct <= 20) return 'bg-dash-teal'
  if (pct <= 40) return 'bg-[#2563EB]'
  if (pct <= 60) return 'bg-dash-gold'
  return 'bg-dash-coral'
}

function evaSeverityClass(value: number | null): string {
  if (value === null) return 'bg-neutral-text-subtle'
  if (value <= 3) return 'bg-dash-teal'
  if (value <= 5) return 'bg-[#2563EB]'
  if (value <= 7) return 'bg-dash-gold'
  return 'bg-dash-coral'
}

export function FunctionalScoresCard({
  scores,
  staggerIndex = 0,
}: {
  scores: QuestionnaireSynthesisPreview['scores']
  staggerIndex?: number
}) {
  return (
    <SynthesisCard title="Scores fonctionnels" staggerIndex={staggerIndex}>
      <div className="space-y-5">
        <ScoreBar
          label="EVA — Douleur"
          value={scores.eva}
          max={10}
          interpretation={scores.evaInterpretation}
          severityClass={evaSeverityClass(scores.eva)}
        />
        <ScoreBar
          label="NDI — Incapacite fonctionnelle"
          value={scores.ndiPct}
          max={100}
          interpretation={scores.ndiLabel}
          severityClass={ndiSeverityClass(scores.ndiPct)}
        />
      </div>
    </SynthesisCard>
  )
}
