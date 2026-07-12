'use client'

import { AlertTriangle, CheckCircle, Zap } from 'lucide-react'
import { BRAND } from '@/lib/brand-tokens'
import type { PatientWorkContext } from '@/lib/patient-work-context'

interface PatientWorkContextBannerProps {
  context: PatientWorkContext
}

const BANNER_STYLES = {
  urgent: {
    background: '#FDF3E8',
    border: '#E8834A',
    title: '#7A2A10',
    desc: '#A03818',
    Icon: AlertTriangle,
    iconColor: BRAND.coral,
  },
  action: {
    background: '#EBF0FA',
    border: `${BRAND.navy}40`,
    title: BRAND.navy,
    desc: BRAND.navyLight,
    Icon: Zap,
    iconColor: BRAND.navy,
  },
  ok: {
    background: '#EDFAF3',
    border: '#18A05040',
    title: '#0A4A28',
    desc: '#16703A',
    Icon: CheckCircle,
    iconColor: BRAND.green,
  },
} as const

export function PatientWorkContextBanner({ context }: PatientWorkContextBannerProps) {
  const style = BANNER_STYLES[context.type]
  const Icon = style.Icon

  return (
    <div
      className="rounded-2xl border-2 px-5 sm:px-6 py-4 sm:py-5 flex items-start gap-3 mb-5"
      style={{ background: style.background, borderColor: style.border }}
      role="status"
    >
      <Icon size={22} color={style.iconColor} className="shrink-0 mt-0.5" aria-hidden />
      <div>
        <div className="text-base sm:text-lg font-bold" style={{ color: style.title }}>
          {context.title}
        </div>
        <div className="text-sm sm:text-base mt-1 leading-relaxed" style={{ color: style.desc }}>
          {context.desc}
        </div>
      </div>
    </div>
  )
}
