import { cn } from '@/lib/utils'
import { Clock, Info } from 'lucide-react'
import type { GlobalStatus } from '@/lib/workflow-v2'

type GuidanceBannerProps = {
  globalStatus: GlobalStatus
  guidance: string
  waitingOnOther?: boolean
  pendingActorLabel?: string
  waitingDetail?: string
  className?: string
}

const STATUS_STYLES: Record<GlobalStatus, string> = {
  draft: 'bg-slate-100 border-slate-300 text-slate-900',
  medical_review: 'bg-blue-100 border-blue-400 text-blue-950',
  medical_more_info: 'bg-amber-100 border-amber-400 text-amber-950',
  rejected: 'bg-red-100 border-red-400 text-red-950',
  commercial_in_progress: 'bg-emerald-100 border-emerald-400 text-emerald-950',
  scheduled: 'bg-green-100 border-green-400 text-green-950',
  closed: 'bg-slate-100 border-slate-300 text-slate-700',
}

export function GuidanceBanner({
  globalStatus,
  guidance,
  waitingOnOther = false,
  pendingActorLabel,
  waitingDetail,
  className,
}: GuidanceBannerProps) {
  return (
    <div
      className={cn(
        'rounded-xl border-2 p-4 sm:p-5 space-y-2',
        STATUS_STYLES[globalStatus],
        className,
      )}
    >
      <div className="flex items-center gap-2 text-base sm:text-lg font-bold">
        {waitingOnOther ? (
          <Clock className="w-5 h-5 shrink-0" aria-hidden />
        ) : (
          <Info className="w-5 h-5 shrink-0" aria-hidden />
        )}
        Prochaine étape
      </div>
      <p className="text-base sm:text-lg font-medium leading-relaxed">{guidance}</p>
      {waitingOnOther && waitingDetail && (
        <div className="pt-3 border-t border-current/20 space-y-1">
          {pendingActorLabel && (
            <p className="text-sm font-bold">Action requise : {pendingActorLabel}</p>
          )}
          <p className="text-sm leading-relaxed opacity-95">{waitingDetail}</p>
        </div>
      )}
    </div>
  )
}
