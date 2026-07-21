'use client'

import { Check, XCircle } from 'lucide-react'
import { BRAND } from '@/lib/brand-tokens'
import { getPipelineSteps } from '@/lib/patient-work-context'
import type { GlobalStatus } from '@/lib/workflow-v2'
import { GLOBAL_STATUS_LABELS } from '@/lib/dashboard-summary'

interface PatientPipelineHeaderProps {
  globalStatus: GlobalStatus
  dateAccepted?: boolean
  statusLabel?: string
  progressDetail?: string | null
}

export function PatientPipelineHeader({
  globalStatus,
  dateAccepted = false,
  statusLabel,
  progressDetail,
}: PatientPipelineHeaderProps) {
  const steps = getPipelineSteps(globalStatus, dateAccepted)
  const label = statusLabel ?? GLOBAL_STATUS_LABELS[globalStatus]

  if (globalStatus === 'closed') {
    return (
      <div
        className="rounded-2xl shadow-sm overflow-hidden mb-5"
        style={{ background: 'white', border: `1px solid ${BRAND.creamMid}` }}
      >
        <div className="px-6 py-5 flex items-center gap-3" style={{ background: BRAND.cream }}>
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shrink-0"
            style={{ background: '#E8E8EC', color: '#5A5A6A', border: '2px solid #B8B8C8' }}
          >
            ⊘
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold" style={{ color: BRAND.dark }}>
              Dossier fermé
            </h3>
            <p className="text-sm" style={{ color: BRAND.slate }}>
              Historique conservé — aucune action workflow en cours.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (globalStatus === 'rejected') {
    return (
      <div
        className="rounded-2xl shadow-sm overflow-hidden mb-5"
        style={{ background: 'white', border: `1px solid ${BRAND.creamMid}` }}
      >
        <div className="px-6 py-5 flex items-center gap-3" style={{ background: '#FAE8E8' }}>
          <XCircle size={22} color="#D04040" className="shrink-0" />
          <div>
            <h3 className="text-base sm:text-lg font-bold text-[#5A1010]">Dossier refusé</h3>
            <p className="text-sm text-[#7A3030]">
              {progressDetail?.trim() || 'Réouverture possible depuis le panneau d’actions.'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl shadow-sm overflow-hidden mb-5"
      style={{ background: 'white', border: `1px solid ${BRAND.creamMid}` }}
    >
      <div
        className="px-5 sm:px-7 py-4 flex items-center justify-between gap-3 border-b"
        style={{ borderColor: BRAND.creamMid }}
      >
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: BRAND.slate }}>
          Parcours du dossier
        </span>
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
          style={{ color: BRAND.navy, background: `${BRAND.navy}12`, border: `1px solid ${BRAND.navy}25` }}
        >
          {label}
        </span>
      </div>
      <div className="px-5 sm:px-7 py-5" style={{ background: BRAND.cream }}>
        <div className="grid grid-cols-4 gap-2 items-center">
          {steps.map((step, index) => (
            <div key={step.label} className="flex items-center">
              <div className="flex flex-col items-center gap-2 flex-shrink-0">
                <div
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all"
                  style={{
                    background: step.done ? BRAND.green : step.active ? BRAND.navy : 'white',
                    borderColor: step.done ? BRAND.green : step.active ? BRAND.navy : BRAND.creamMid,
                    color: step.done || step.active ? 'white' : BRAND.slateLight,
                    boxShadow: step.active ? `0 0 0 4px ${BRAND.navy}18` : undefined,
                  }}
                >
                  {step.done ? <Check size={16} /> : index + 1}
                </div>
                <span
                  className="text-xs sm:text-sm font-bold text-center leading-tight"
                  style={{
                    color: step.done ? BRAND.green : step.active ? BRAND.navy : BRAND.slateLight,
                  }}
                >
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className="flex-1 h-0.5 mx-1 sm:mx-2 mb-6 rounded-full"
                  style={{ background: step.done ? BRAND.green : BRAND.creamMid }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
