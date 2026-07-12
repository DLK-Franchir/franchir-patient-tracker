'use client'

import { Activity, Zap } from 'lucide-react'
import { BRAND } from '@/lib/brand-tokens'
import type { DashboardKpi } from '@/lib/dashboard-summary'

type DashboardKpiGridProps = {
  kpis: DashboardKpi[]
  activeKpiId?: string | null
  onKpiClick: (kpi: DashboardKpi) => void
}

function KpiCard({
  kpi,
  active,
  onClick,
}: {
  kpi: DashboardKpi
  active: boolean
  onClick: () => void
}) {
  const urgent = kpi.urgent && kpi.count > 0

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl p-5 text-left shadow-sm transition-all hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E2B70]"
      style={{
        background: 'white',
        border: active
          ? `2px solid ${kpi.accentColor}`
          : urgent
            ? `2px solid ${kpi.accentColor}40`
            : `1px solid ${BRAND.creamMid}`,
        boxShadow: active
          ? `0 0 0 4px ${kpi.accentColor}18`
          : urgent
            ? `0 0 0 4px ${kpi.accentColor}0C`
            : undefined,
      }}
    >
      <div
        className="mb-4 flex h-8 w-8 items-center justify-center rounded-xl"
        style={{ background: `${kpi.accentColor}18` }}
      >
        {urgent ? (
          <Zap size={15} style={{ color: kpi.accentColor }} />
        ) : (
          <Activity size={15} style={{ color: kpi.accentColor }} />
        )}
      </div>
      <div
        className="font-black leading-none"
        style={{
          fontSize: '48px',
          color: kpi.accentColor,
          fontFamily: 'var(--font-nunito), var(--font-geist-sans), sans-serif',
        }}
      >
        {kpi.count}
      </div>
      <div
        className="mt-2 font-bold leading-snug"
        style={{ fontSize: '14px', color: BRAND.navy }}
      >
        {kpi.label}
      </div>
      <div className="mt-0.5 leading-snug" style={{ fontSize: '12px', color: BRAND.slate }}>
        {kpi.sub}
      </div>
      {urgent && (
        <div
          className="mt-3 flex items-center gap-1.5 rounded-lg px-2 py-1"
          style={{ background: `${kpi.accentColor}14` }}
        >
          <span
            className="h-1.5 w-1.5 animate-pulse rounded-full"
            style={{ background: kpi.dotColor }}
          />
          <span className="text-[11px] font-bold" style={{ color: kpi.accentColor }}>
            {kpi.count} action{kpi.count > 1 ? 's' : ''} requise{kpi.count > 1 ? 's' : ''}
          </span>
        </div>
      )}
    </button>
  )
}

export default function DashboardKpiGrid({
  kpis,
  activeKpiId,
  onKpiClick,
}: DashboardKpiGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {kpis.map((kpi) => (
        <KpiCard
          key={kpi.id}
          kpi={kpi}
          active={activeKpiId === kpi.id}
          onClick={() => onKpiClick(kpi)}
        />
      ))}
    </div>
  )
}
