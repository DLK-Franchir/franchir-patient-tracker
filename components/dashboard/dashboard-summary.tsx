'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { GuidanceBanner } from '@/components/ui/guidance-banner'
import {
  GLOBAL_STATUS_DB_CODES,
  GLOBAL_STATUS_LABELS,
  PIPELINE_GLOBAL_STATUSES,
  type DashboardFocus,
  type DashboardPriorityBanner,
  type DashboardSummary,
  selectedGlobalStatusFromCodes,
} from '@/lib/dashboard-summary'
import type { GlobalStatus, UserRole } from '@/lib/workflow-v2'

type DashboardSummaryHeaderProps = {
  summary: DashboardSummary
  focus: DashboardFocus
  selectedStatuses: string[]
  userRole: UserRole
  priorityBanner: DashboardPriorityBanner | null
}

function ChipButton({
  active,
  onClick,
  children,
  count,
  variant = 'default',
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  count?: number
  variant?: 'default' | 'action' | 'waiting'
}) {
  const base =
    'inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]'

  const styles = {
    default: active
      ? 'border-[#2563EB] bg-blue-50 text-[#2563EB]'
      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
    action: active
      ? 'border-amber-500 bg-amber-100 text-amber-950'
      : 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100',
    waiting: active
      ? 'border-blue-500 bg-blue-100 text-blue-950'
      : 'border-blue-300 bg-blue-50 text-blue-900 hover:bg-blue-100',
  }

  return (
    <button type="button" onClick={onClick} className={cn(base, styles[variant])}>
      {children}
      {count !== undefined && count > 0 && (
        <span
          className={cn(
            'inline-flex min-w-[1.5rem] items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-bold',
            active ? 'bg-white/70' : 'bg-gray-100 text-gray-700',
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}

export default function DashboardSummaryHeader({
  summary,
  focus,
  selectedStatuses,
  userRole,
  priorityBanner,
}: DashboardSummaryHeaderProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const selectedPipelineStatus = selectedGlobalStatusFromCodes(selectedStatuses)

  const buildUrl = (updates: { focus?: DashboardFocus | null; status?: string[] | null; page?: number }) => {
    const params = new URLSearchParams(searchParams.toString())

    if (updates.focus !== undefined) {
      if (updates.focus && updates.focus !== 'all') {
        params.set('focus', updates.focus)
      } else {
        params.delete('focus')
      }
    }

    if (updates.status !== undefined) {
      params.delete('status')
      updates.status?.forEach((code) => params.append('status', code))
    }

    params.set('page', String(updates.page ?? 1))
    return `/dashboard?${params.toString()}`
  }

  const navigate = (updates: { focus?: DashboardFocus | null; status?: string[] | null }) => {
    startTransition(() => {
      router.push(buildUrl({ ...updates, page: 1 }))
    })
  }

  const toggleFocus = (next: 'mine' | 'waiting') => {
    navigate({ focus: focus === next ? 'all' : next })
  }

  const togglePipelineStatus = (globalStatus: GlobalStatus) => {
    const codes = GLOBAL_STATUS_DB_CODES[globalStatus]
    const isActive =
      selectedPipelineStatus === globalStatus ||
      codes.every((code) => selectedStatuses.includes(code))

    navigate({
      status: isActive ? null : codes,
      focus: focus !== 'all' ? focus : null,
    })
  }

  return (
    <div className={cn('space-y-4', isPending && 'opacity-80')}>
      {priorityBanner && (
        <GuidanceBanner
          globalStatus={priorityBanner.globalStatus}
          guidance={priorityBanner.guidance}
          waitingOnOther={priorityBanner.waitingOnOther}
          pendingActorLabel={priorityBanner.pendingActorLabel}
          waitingDetail={priorityBanner.waitingDetail}
        />
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="mb-3 text-sm font-semibold text-gray-700">Vue cockpit</p>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <ChipButton
            active={focus === 'mine'}
            onClick={() => toggleFocus('mine')}
            count={summary.mine}
            variant="action"
          >
            Mes actions
          </ChipButton>
          <ChipButton
            active={focus === 'waiting'}
            onClick={() => toggleFocus('waiting')}
            count={summary.waiting}
            variant="waiting"
          >
            En attente
          </ChipButton>

          <span className="mx-1 hidden h-8 w-px shrink-0 self-center bg-gray-200 sm:block" aria-hidden />

          {PIPELINE_GLOBAL_STATUSES.map((globalStatus) => {
            const count = summary.byGlobalStatus[globalStatus]
            const active = selectedPipelineStatus === globalStatus
            return (
              <ChipButton
                key={globalStatus}
                active={active}
                onClick={() => togglePipelineStatus(globalStatus)}
                count={count}
              >
                {GLOBAL_STATUS_LABELS[globalStatus]}
              </ChipButton>
            )
          })}

          {summary.closed > 0 && (
            <ChipButton
              active={selectedPipelineStatus === 'closed'}
              onClick={() => togglePipelineStatus('closed')}
              count={summary.closed}
            >
              {GLOBAL_STATUS_LABELS.closed}
            </ChipButton>
          )}
        </div>

        <p className="mt-3 text-xs text-gray-500">
          {summary.totalActive} dossier{summary.totalActive > 1 ? 's' : ''} actif
          {summary.totalActive > 1 ? 's' : ''}
          {summary.closed > 0
            ? ` · ${summary.closed} fermé${summary.closed > 1 ? 's' : ''}`
            : ''}
          {' · '}
          Rôle : <span className="font-semibold">{userRole}</span>
        </p>
      </div>
    </div>
  )
}
