'use client'

import { FormEvent, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { BRAND } from '@/lib/brand-tokens'
import { cn } from '@/lib/utils'
import DashboardKpiGrid from '@/components/dashboard/dashboard-kpi-grid'
import {
  DASHBOARD_TABS,
  formatMineBreakdown,
  getDashboardKpis,
  getDashboardTabsForRole,
  getTabCount,
  GLOBAL_STATUS_DB_CODES,
  selectedGlobalStatusFromCodes,
  type DashboardFocus,
  type DashboardKpi,
  type DashboardSummary,
  type DashboardTabId,
} from '@/lib/dashboard-summary'
import type { UserRole } from '@/lib/workflow-v2'

type DashboardSummaryHeaderProps = {
  summary: DashboardSummary
  focus: DashboardFocus
  selectedStatuses: string[]
  activeTab: DashboardTabId | null
  activeKpi: string | null
  userRole: UserRole
  userDisplayName?: string
  searchQuery: string
  totalPatients: number
  onSearchChange: (value: string) => void
  onSearchSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export default function DashboardSummaryHeader({
  summary,
  focus,
  selectedStatuses,
  activeTab,
  activeKpi,
  userRole,
  userDisplayName,
  searchQuery,
  totalPatients,
  onSearchChange,
  onSearchSubmit,
}: DashboardSummaryHeaderProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const kpis = getDashboardKpis(summary, userRole)
  const dashboardTabs = getDashboardTabsForRole(userRole)
  const selectedPipelineStatus = selectedGlobalStatusFromCodes(selectedStatuses)
  const resolvedTab =
    activeTab ??
    (selectedPipelineStatus
      ? (DASHBOARD_TABS.find(
          (tab) =>
            tab.globalStatuses.length === 1 &&
            tab.globalStatuses[0] === selectedPipelineStatus,
        )?.id ?? null)
      : focus === 'mine'
        ? null
        : 'actifs')

  const buildUrl = (updates: {
    focus?: DashboardFocus | null
    status?: string[] | null
    tab?: DashboardTabId | null
    kpi?: string | null
    q?: string | null
    page?: number
  }) => {
    const params = new URLSearchParams(searchParams.toString())

    if (updates.focus !== undefined) {
      if (updates.focus && updates.focus !== 'all') params.set('focus', updates.focus)
      else params.delete('focus')
    }

    if (updates.status !== undefined) {
      params.delete('status')
      updates.status?.forEach((code) => params.append('status', code))
    }

    if (updates.tab !== undefined) {
      if (updates.tab) params.set('tab', updates.tab)
      else params.delete('tab')
    }

    if (updates.kpi !== undefined) {
      if (updates.kpi) params.set('kpi', updates.kpi)
      else params.delete('kpi')
    }

    if (updates.q !== undefined) {
      if (updates.q) params.set('q', updates.q)
      else params.delete('q')
    }

    params.set('page', String(updates.page ?? 1))
    return `/dashboard?${params.toString()}`
  }

  const navigate = (updates: Parameters<typeof buildUrl>[0]) => {
    startTransition(() => {
      router.push(buildUrl(updates))
    })
  }

  const handleKpiClick = (kpi: DashboardKpi) => {
    const isActive = activeKpi === kpi.id
    if (isActive) {
      navigate({ kpi: null, tab: 'actifs', focus: null, status: null })
      return
    }
    navigate({
      kpi: kpi.id,
      tab: kpi.filter.tab ?? null,
      focus: null,
      status: kpi.filter.status ?? null,
    })
  }

  const handleTabClick = (tabId: DashboardTabId) => {
    const isActive = resolvedTab === tabId && !activeKpi && focus !== 'mine'
    if (isActive) {
      navigate({ tab: 'actifs', status: null, focus: null, kpi: null })
      return
    }

    if (tabId === 'actifs' || tabId === 'all') {
      navigate({ tab: tabId, status: null, focus: null, kpi: null })
      return
    }

    const tabDef = DASHBOARD_TABS.find((tab) => tab.id === tabId)
    const statusCodes =
      tabDef?.globalStatuses.flatMap(
        (globalStatus) => GLOBAL_STATUS_DB_CODES[globalStatus],
      ) ?? null

    navigate({ tab: tabId, status: statusCodes, focus: null, kpi: null })
  }

  const toggleMineFocus = () => {
    if (focus === 'mine') {
      navigate({ focus: null, kpi: null })
      return
    }
    navigate({ focus: 'mine', status: null, tab: null, kpi: null })
  }

  const clearSearch = () => {
    onSearchChange('')
    navigate({ q: null })
  }

  return (
    <div className={cn('space-y-7', isPending && 'opacity-80')}>
      <section>
        <div className="mb-5 flex flex-wrap items-baseline gap-3">
          <h2
            className="font-extrabold"
            style={{
              fontFamily: 'var(--font-nunito), var(--font-geist-sans), sans-serif',
              fontSize: '22px',
              color: BRAND.navy,
            }}
          >
            Synthèse des dossiers
            {userDisplayName ? (
              <span style={{ fontWeight: 700, color: BRAND.ink }}> · {userDisplayName}</span>
            ) : null}
          </h2>
          <span style={{ fontSize: '14px', color: BRAND.slate }}>
            · {totalPatients} dossier{totalPatients > 1 ? 's' : ''} au total
          </span>
        </div>

        <DashboardKpiGrid kpis={kpis} activeKpiId={activeKpi} onKpiClick={handleKpiClick} />

        {summary.mine > 0 && (
          <p className="mt-4 text-sm" style={{ color: BRAND.ink }}>
            <button
              type="button"
              onClick={toggleMineFocus}
              className="font-semibold underline-offset-2 hover:underline"
              style={{ color: focus === 'mine' ? BRAND.coral : BRAND.navy }}
            >
              {summary.mine} dossier{summary.mine > 1 ? 's' : ''} vous attend
              {summary.mine > 1 ? 'ent' : ''}
            </button>
            {' — '}
            {formatMineBreakdown(summary.mineBreakdown, userRole)}
          </p>
        )}
      </section>

      <section
        className="overflow-hidden rounded-2xl shadow-sm"
        style={{ background: 'white', border: `1px solid ${BRAND.creamMid}` }}
      >
        <div className="flex flex-col items-start gap-3 px-4 py-3 sm:flex-row sm:items-center">
          <div className="flex shrink-0 items-center gap-2">
            <SlidersHorizontal size={13} style={{ color: BRAND.slate }} />
            <span
              className="text-[11px] font-bold tracking-wider uppercase"
              style={{ color: BRAND.slate }}
            >
              Filtrer
            </span>
          </div>

          <div className="flex flex-1 items-center gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {focus === 'mine' && (
              <button
                type="button"
                onClick={toggleMineFocus}
                className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-bold whitespace-nowrap"
                style={{ background: BRAND.coral, color: 'white' }}
              >
                Mes actions
                <span
                  className="rounded-full px-1.5 py-0.5 text-[11px] leading-none font-bold"
                  style={{ background: 'rgba(255,255,255,0.25)' }}
                >
                  {summary.mine}
                </span>
              </button>
            )}

            {dashboardTabs.map((tab) => {
              const count = getTabCount(summary, tab.id)
              const active =
                !activeKpi &&
                focus !== 'mine' &&
                (resolvedTab === tab.id ||
                  (tab.id !== 'actifs' &&
                    tab.globalStatuses.length === 1 &&
                    selectedPipelineStatus === tab.globalStatuses[0]))

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabClick(tab.id)}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 whitespace-nowrap transition-all"
                  style={{
                    fontSize: '13px',
                    fontWeight: active ? 700 : 500,
                    background: active ? BRAND.navy : 'transparent',
                    color: active ? 'white' : BRAND.ink,
                  }}
                  onMouseEnter={(event) => {
                    if (!active) event.currentTarget.style.background = BRAND.creamDark
                  }}
                  onMouseLeave={(event) => {
                    if (!active) event.currentTarget.style.background = 'transparent'
                  }}
                >
                  {tab.label}
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[11px] leading-none font-bold"
                    style={{
                      background: active ? 'rgba(255,255,255,0.2)' : BRAND.creamDark,
                      color: active ? 'white' : BRAND.slate,
                    }}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          <form onSubmit={onSearchSubmit} className="flex w-full gap-2 sm:ml-auto sm:w-auto">
            <div className="relative min-w-0 flex-1 sm:flex-none">
              <Search
                size={14}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
                style={{ color: BRAND.slateLight }}
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Rechercher…"
                className="w-full rounded-xl py-1.5 pr-8 pl-9 text-[14px] focus:outline-none sm:w-48"
                style={{
                  background: BRAND.cream,
                  border: `1px solid ${BRAND.creamMid}`,
                  color: BRAND.dark,
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute top-1/2 right-2.5 -translate-y-1/2"
                  style={{ color: BRAND.slate }}
                  aria-label="Effacer la recherche"
                >
                  <X size={13} />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="shrink-0 rounded-xl px-3.5 py-1.5 text-[13px] font-semibold transition-colors"
              style={{ background: BRAND.creamDark, color: BRAND.navy }}
            >
              OK
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}
