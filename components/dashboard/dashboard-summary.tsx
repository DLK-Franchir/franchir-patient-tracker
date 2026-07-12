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
  getEffectiveDashboardTab,
  getGillesPriorityMessage,
  getTabCount,
  GLOBAL_STATUS_DB_CODES,
  type DashboardFocus,
  type DashboardKpi,
  type DashboardKpiId,
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
  selectedStatuses: _selectedStatuses,
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
  const showAllScoped = searchParams.get('all') === '1'
  const effectiveTab = getEffectiveDashboardTab(
    activeTab,
    (activeKpi as DashboardKpiId | null) ?? null,
  )
  const hasActiveListFilter =
    !showAllScoped && (focus !== 'all' || Boolean(effectiveTab) || Boolean(activeKpi))
  const gillesPriorityMessage =
    userRole === 'gilles' ? getGillesPriorityMessage(summary) : null
  const gillesFirstName =
    userRole === 'gilles'
      ? (userDisplayName?.replace(/^Dr\.?\s+/i, '').trim().split(/\s+/)[0] ?? 'Gilles')
      : null

  const showAllDossiers = () => {
    navigate({ all: true, focus: null, tab: null, kpi: null, status: null })
  }

  const buildUrl = (updates: {
    focus?: DashboardFocus | null
    status?: string[] | null
    tab?: DashboardTabId | null
    kpi?: string | null
    q?: string | null
    page?: number
    all?: boolean | null
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

    if (updates.all !== undefined) {
      if (updates.all) params.set('all', '1')
      else params.delete('all')
    }

    params.set('page', String(updates.page ?? 1))
    return `/dashboard?${params.toString()}`
  }

  const navigate = (updates: Parameters<typeof buildUrl>[0]) => {
    startTransition(() => {
      router.push(buildUrl(updates))
    })
  }

  const clearListFilters = () => {
    if (userRole === 'gilles') {
      navigate({ kpi: null, tab: null, focus: null, status: null, all: true })
      return
    }
    navigate({ kpi: null, tab: 'actifs', focus: null, status: null })
  }

  const handleKpiClick = (kpi: DashboardKpi) => {
    const isActive = activeKpi === kpi.id
    if (isActive) {
      clearListFilters()
      return
    }
    navigate({
      kpi: kpi.id,
      tab: kpi.filter.tab ?? null,
      focus: null,
      status: kpi.filter.status ?? null,
      all: null,
    })
  }

  const handleTabClick = (tabId: DashboardTabId) => {
    const isActive = effectiveTab === tabId && focus !== 'mine' && !showAllScoped
    if (isActive) {
      clearListFilters()
      return
    }

    if (tabId === 'actifs' || tabId === 'all') {
      navigate({ tab: tabId, status: null, focus: null, kpi: null, all: null })
      return
    }

    const tabDef = DASHBOARD_TABS.find((tab) => tab.id === tabId)
    const statusCodes =
      tabDef?.globalStatuses.flatMap(
        (globalStatus) => GLOBAL_STATUS_DB_CODES[globalStatus],
      ) ?? null

    navigate({ tab: tabId, status: statusCodes, focus: null, kpi: null, all: null })
  }

  const toggleMineFocus = () => {
    if (focus === 'mine') {
      navigate({ focus: null, kpi: null, tab: null, status: null, all: true })
      return
    }
    navigate({ focus: 'mine', status: null, tab: null, kpi: null, all: null })
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

        <DashboardKpiGrid
          kpis={kpis}
          activeKpiId={showAllScoped ? null : activeKpi}
          onKpiClick={handleKpiClick}
        />

        {gillesPriorityMessage && (
          <div
            className="mt-4 flex flex-col gap-3 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4"
            style={{ borderColor: `${BRAND.revue}55`, background: `${BRAND.revue}14` }}
          >
            <p className="text-[15px] font-bold leading-snug" style={{ color: BRAND.navy }}>
              Dr {gillesFirstName}, {gillesPriorityMessage}
            </p>
            {focus !== 'mine' && (
              <button
                type="button"
                onClick={() =>
                  navigate({ focus: 'mine', tab: null, kpi: null, status: null, all: null })
                }
                className="shrink-0 rounded-xl px-4 py-2 text-[13px] font-bold text-white"
                style={{ background: BRAND.coral }}
              >
                Voir les {summary.byGlobalStatus.medical_review} dossier
                {summary.byGlobalStatus.medical_review > 1 ? 's' : ''} à valider →
              </button>
            )}
            {focus === 'mine' && (
              <span className="text-[13px] font-semibold" style={{ color: BRAND.revue }}>
                Liste filtrée sur vos actions en cours
              </span>
            )}
          </div>
        )}

        {summary.mine > 0 && userRole !== 'gilles' && (
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
            {userRole === 'gilles' && (
              <button
                type="button"
                onClick={showAllDossiers}
                className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-bold whitespace-nowrap transition-all"
                style={{
                  background: showAllScoped || !hasActiveListFilter ? BRAND.navy : 'transparent',
                  color: showAllScoped || !hasActiveListFilter ? 'white' : BRAND.ink,
                }}
                onMouseEnter={(event) => {
                  if (!showAllScoped && hasActiveListFilter) {
                    event.currentTarget.style.background = BRAND.creamDark
                  }
                }}
                onMouseLeave={(event) => {
                  if (!showAllScoped && hasActiveListFilter) {
                    event.currentTarget.style.background = 'transparent'
                  }
                }}
              >
                Tous les dossiers
                <span
                  className="rounded-full px-1.5 py-0.5 text-[11px] leading-none font-bold"
                  style={{
                    background:
                      showAllScoped || !hasActiveListFilter
                        ? 'rgba(255,255,255,0.25)'
                        : BRAND.creamDark,
                    color: showAllScoped || !hasActiveListFilter ? 'white' : BRAND.slate,
                  }}
                >
                  {totalPatients}
                </span>
              </button>
            )}

            {summary.mine > 0 && userRole !== 'gilles' && (
              <button
                type="button"
                onClick={toggleMineFocus}
                className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-bold whitespace-nowrap transition-all"
                style={{
                  background: focus === 'mine' ? BRAND.coral : 'transparent',
                  color: focus === 'mine' ? 'white' : BRAND.ink,
                }}
                onMouseEnter={(event) => {
                  if (focus !== 'mine') event.currentTarget.style.background = BRAND.creamDark
                }}
                onMouseLeave={(event) => {
                  if (focus !== 'mine') event.currentTarget.style.background = 'transparent'
                }}
              >
                Mes actions
                <span
                  className="rounded-full px-1.5 py-0.5 text-[11px] leading-none font-bold"
                  style={{
                    background: focus === 'mine' ? 'rgba(255,255,255,0.25)' : BRAND.creamDark,
                    color: focus === 'mine' ? 'white' : BRAND.slate,
                  }}
                >
                  {summary.mine}
                </span>
              </button>
            )}

            {dashboardTabs.map((tab) => {
              const count = getTabCount(summary, tab.id)
              const active =
                !showAllScoped && focus !== 'mine' && effectiveTab === tab.id

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
