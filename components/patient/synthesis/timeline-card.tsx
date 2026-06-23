import { Clock } from 'lucide-react'
import type { TimelineEvent } from '@/lib/integrations/questionnaire-synthesis-preview.types'
import { SynthesisCard } from '@/components/patient/synthesis/synthesis-card'

type TimelineCardProps = {
  events: TimelineEvent[]
  staggerIndex?: number
}

export function TimelineCard({ events, staggerIndex = 0 }: TimelineCardProps) {
  return (
    <SynthesisCard title="Chronologie" staggerIndex={staggerIndex}>
      {events.length === 0 ? (
        <p className="text-sm italic text-neutral-text-subtle">Chronologie non renseignee</p>
      ) : (
        <ol className="relative space-y-0 border-l-2 border-dash-teal/30 pl-6">
          {events.map((event) => (
            <li key={event.id} className="relative pb-5 last:pb-0">
              <span
                className="absolute -left-[1.4rem] top-1 flex size-5 items-center justify-center rounded-full bg-dash-teal/15 text-dash-teal"
                aria-hidden="true"
              >
                <Clock className="size-3" />
              </span>
              <p className="text-sm font-bold text-neutral-text">{event.label}</p>
              {event.detail ? (
                <p className="mt-0.5 text-sm text-neutral-text-muted">{event.detail}</p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </SynthesisCard>
  )
}
