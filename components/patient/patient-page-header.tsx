'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, XCircle } from 'lucide-react'
import { BRAND, brandTypography } from '@/lib/brand-tokens'
import { GLOBAL_STATUS_LABELS } from '@/lib/dashboard-summary'
import { getPipelineSteps } from '@/lib/patient-work-context'
import { StatusBadge } from '@/components/ui/status-badge'
import { isClosedGlobalStatus, type GlobalStatus } from '@/lib/workflow-v2'

interface PatientPageHeaderProps {
  patientName: string
  patientEmail?: string | null
  patientPhone?: string | null
  createdAt: string
  globalStatus: GlobalStatus
  statusLabel?: string
  statusColor?: string | null
  dateAccepted?: boolean
  progressDetail?: string | null
}

function patientInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? parts[0]?.[1] ?? ''}`.toUpperCase()
}

function MetaItem({ children }: { children: ReactNode }) {
  return <span className="whitespace-nowrap">{children}</span>
}

function MetaSeparator() {
  return (
    <span aria-hidden className="hidden sm:inline" style={{ color: BRAND.slateLight }}>
      |
    </span>
  )
}

function PipelineSteps({
  globalStatus,
  dateAccepted,
  progressDetail,
}: {
  globalStatus: GlobalStatus
  dateAccepted?: boolean
  progressDetail?: string | null
}) {
  if (globalStatus === 'closed') {
    return (
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold"
          style={{ background: '#E8E8EC', color: '#5A5A6A', border: '2px solid #B8B8C8' }}
        >
          ⊘
        </div>
        <div>
          <p className="text-base font-bold" style={{ color: BRAND.dark }}>
            Dossier fermé
          </p>
          <p className="text-sm" style={{ color: BRAND.slate }}>
            Historique conservé — aucune action workflow en cours.
          </p>
        </div>
      </div>
    )
  }

  if (globalStatus === 'rejected') {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <XCircle size={20} color="#D04040" className="shrink-0" aria-hidden />
        <span className="text-base font-bold text-[#5A1010]">Dossier refusé</span>
        <span className="text-[15px]" style={{ color: BRAND.slate }}>
          — {progressDetail?.trim() || 'Réouverture possible depuis le panneau d’actions.'}
        </span>
      </div>
    )
  }

  const steps = getPipelineSteps(globalStatus, dateAccepted)

  return (
    <div className="grid grid-cols-4 items-center gap-2">
      {steps.map((step, index) => (
        <div key={step.label} className="flex items-center">
          <div className="flex shrink-0 flex-col items-center gap-2">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold transition-all"
              style={{
                background: step.done ? BRAND.green : step.active ? BRAND.navy : 'white',
                borderColor: step.done ? BRAND.green : step.active ? BRAND.navy : BRAND.creamMid,
                color: step.done || step.active ? 'white' : BRAND.slateLight,
                boxShadow: step.active ? `0 0 0 5px ${BRAND.navy}18` : undefined,
              }}
            >
              {step.done ? <Check size={16} /> : index + 1}
            </div>
            <span
              className="text-center text-[13px] font-bold leading-tight"
              style={{
                color: step.done ? BRAND.green : step.active ? BRAND.navy : BRAND.slateLight,
              }}
            >
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div
              className="mx-2 mb-6 h-0.5 flex-1 rounded-full"
              style={{ background: step.done ? BRAND.green : BRAND.creamMid }}
            />
          )}
        </div>
      ))}
    </div>
  )
}

export function PatientPageHeader({
  patientName,
  patientEmail,
  patientPhone,
  createdAt,
  globalStatus,
  statusLabel,
  statusColor,
  dateAccepted = false,
  progressDetail,
}: PatientPageHeaderProps) {
  const label = statusLabel ?? GLOBAL_STATUS_LABELS[globalStatus]
  const badgeColor = isClosedGlobalStatus(globalStatus) ? '#8A8A9A' : statusColor ?? undefined
  const createdLabel = new Date(createdAt).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const metaItems: ReactNode[] = [
    <MetaItem key="created">Créé le {createdLabel}</MetaItem>,
  ]
  if (patientEmail) metaItems.push(<MetaItem key="email">{patientEmail}</MetaItem>)
  if (patientPhone) metaItems.push(<MetaItem key="phone">{patientPhone}</MetaItem>)

  return (
    <div
      className="mb-5 overflow-hidden rounded-2xl shadow-sm"
      style={{ background: 'white', border: `1px solid ${BRAND.creamMid}` }}
    >
      <div
        style={{
          background: `${BRAND.navy}08`,
          borderBottom: `1px solid ${BRAND.navy}12`,
        }}
        className="px-6 py-2.5 sm:px-7"
      >
        <Link
          href="/dashboard"
          className="group inline-flex items-center gap-2 text-[14px] font-semibold transition-colors hover:text-[#1E2B70]"
          style={{ color: BRAND.slate }}
        >
          <ArrowLeft size={15} aria-hidden />
          <span>Retour au tableau de suivi</span>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-4 px-5 py-5 sm:gap-5 sm:px-7 sm:py-6">
        <div
          className="flex shrink-0 items-center justify-center rounded-full font-black"
          style={{
            width: '72px',
            height: '72px',
            background: `linear-gradient(135deg, ${BRAND.navy}, ${BRAND.navyLight})`,
            color: 'white',
            fontSize: '26px',
            boxShadow: `0 4px 16px ${BRAND.navy}30`,
          }}
          aria-hidden
        >
          {patientInitials(patientName)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <h1
              className="text-[26px] font-black leading-none sm:text-[30px]"
              style={{ color: BRAND.navy, fontFamily: brandTypography.display }}
            >
              {patientName}
            </h1>
            <StatusBadge label={label} color={badgeColor} size="md" nowrap />
          </div>
          <div
            className="flex flex-wrap items-center gap-x-4 gap-y-1"
            style={{ fontSize: '15px', color: BRAND.slate }}
          >
            {metaItems.map((item, index) => (
              <span key={index} className="inline-flex items-center gap-4">
                {index > 0 && <MetaSeparator />}
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div
        className="px-5 py-5 sm:px-7"
        style={{ background: BRAND.cream, borderTop: `1px solid ${BRAND.creamMid}` }}
      >
        <PipelineSteps
          globalStatus={globalStatus}
          dateAccepted={dateAccepted}
          progressDetail={progressDetail}
        />
      </div>
    </div>
  )
}
