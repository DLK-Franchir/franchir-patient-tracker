import { Activity, AlertCircle, AlertTriangle, Stethoscope } from 'lucide-react'
import type { ClinicalFlag } from '@/lib/integrations/questionnaire-synthesis-preview.types'
import { SynthesisCard } from '@/components/patient/synthesis/synthesis-card'

type ClinicalFlagsCardProps = {
  flags: ClinicalFlag[]
  staggerIndex?: number
}

const SEVERITY_STYLES: Record<ClinicalFlag['severity'], string> = {
  critical: 'border-danger-border bg-danger-soft text-danger-strong',
  warning: 'border-warning-border bg-warning-soft text-warning-strong',
  info: 'border-info-border bg-info-soft text-info',
}

function FlagIcon({ flag }: { flag: ClinicalFlag }) {
  if (flag.icon === 'allergy') return <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
  if (flag.icon === 'medication') return <Stethoscope className="size-4 shrink-0" aria-hidden="true" />
  if (flag.icon === 'heart') return <Activity className="size-4 shrink-0" aria-hidden="true" />
  return <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
}

export function ClinicalFlagsCard({ flags, staggerIndex = 0 }: ClinicalFlagsCardProps) {
  return (
    <SynthesisCard
      title="Drapeaux cliniques"
      description={
        flags.length === 0 ? "Aucun signal d'alerte detecte" : `${flags.length} point(s) d'attention`
      }
      staggerIndex={staggerIndex}
    >
      {flags.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-success-border bg-success-soft px-4 py-3">
          <AlertCircle className="size-5 text-success" aria-hidden="true" />
          <p className="text-sm font-medium text-success-strong">Aucun drapeau clinique prioritaire</p>
        </div>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {flags.map((flag) => (
            <li
              key={flag.id}
              className={`inline-flex max-w-full items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${SEVERITY_STYLES[flag.severity]}`}
            >
              <FlagIcon flag={flag} />
              <span className="min-w-0">{flag.label}</span>
            </li>
          ))}
        </ul>
      )}
    </SynthesisCard>
  )
}
