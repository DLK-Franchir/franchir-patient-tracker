import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type SynthesisCardProps = {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  staggerIndex?: number
}

export function SynthesisCard({
  title,
  description,
  actions,
  children,
  className,
  staggerIndex = 0,
}: SynthesisCardProps) {
  return (
    <section
      className={cn(
        'synthesis-card-enter rounded-[var(--dash-radius-card)] border border-neutral-border/60 bg-neutral-surface shadow-[var(--dash-shadow-card)]',
        className,
      )}
      style={{ animationDelay: `${staggerIndex * 60}ms` }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-border/50 px-5 py-4">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-neutral-text">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-sm text-neutral-text-muted">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}
