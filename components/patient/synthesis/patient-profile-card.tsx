import { Phone } from 'lucide-react'
import type { QuestionnaireSynthesisPreview } from '@/lib/integrations/questionnaire-synthesis-preview.types'
import { SynthesisCard } from '@/components/patient/synthesis/synthesis-card'

type PatientProfileCardProps = {
  patientName: string
  preview: QuestionnaireSynthesisPreview
  staggerIndex?: number
}

export function PatientProfileCard({
  patientName,
  preview,
  staggerIndex = 0,
}: PatientProfileCardProps) {
  const { profile } = preview
  const birthFormatted = profile.birthDateDisplay
  const demographics = [
    profile.age,
    profile.gender,
    birthFormatted ? `Ne(e) le ${birthFormatted}` : null,
  ]
    .filter(Boolean)
    .join(' — ')

  const initials = patientName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?'

  return (
    <SynthesisCard title="Profil patient" staggerIndex={staggerIndex}>
      <div className="flex gap-4">
        <div className="flex size-14 flex-shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-lg font-bold text-brand">
          {initials}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-lg font-bold text-neutral-text">{patientName}</p>
            {demographics ? (
              <p className="mt-0.5 text-sm text-neutral-text-muted">{demographics}</p>
            ) : null}
          </div>
          {profile.reason ? (
            <div className="rounded-xl border border-info-border bg-info-soft px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-info">Motif</p>
              <p className="mt-1 text-sm font-medium text-neutral-text">{profile.reason}</p>
            </div>
          ) : null}
          {profile.primaryQuestion ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-text-muted">
                Question principale
              </p>
              <p className="mt-1 text-sm text-neutral-text">{profile.primaryQuestion}</p>
            </div>
          ) : null}
          {profile.patientGoal ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-text-muted">
                Objectif du patient
              </p>
              <p className="mt-1 text-sm text-neutral-text">{profile.patientGoal}</p>
            </div>
          ) : null}
          {profile.phone ? (
            <p className="flex items-center gap-2 text-sm text-neutral-text-muted">
              <Phone className="size-4" aria-hidden="true" />
              {profile.phone}
            </p>
          ) : null}
        </div>
      </div>
    </SynthesisCard>
  )
}
