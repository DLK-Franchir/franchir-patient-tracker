'use client'

import Link from 'next/link'
import {
  Check,
  ChevronRight,
  FilePlus,
  RotateCcw,
  Send,
} from 'lucide-react'
import { BRAND } from '@/lib/brand-tokens'
import {
  getAvailableActions,
  type Action,
  type GlobalStatus,
  type UserRole,
} from '@/lib/workflow-v2'

type PatientRowActionProps = {
  patientId: string
  globalStatus: GlobalStatus
  userRole: UserRole
  quoteAccepted?: boolean
  dateAccepted?: boolean
}

type BtnVariant = 'coral' | 'navy' | 'green' | 'orange' | 'ghost'

const BTN_STYLES: Record<BtnVariant, { bg: string; color: string; hoverBg: string }> = {
  coral: { bg: BRAND.coral, color: '#fff', hoverBg: BRAND.coralDark },
  navy: { bg: BRAND.navy, color: '#fff', hoverBg: BRAND.navyDark },
  green: { bg: BRAND.green, color: '#fff', hoverBg: '#0E8040' },
  orange: { bg: BRAND.orange, color: '#fff', hoverBg: '#B45309' },
  ghost: { bg: '#E8E2D0', color: BRAND.navy, hoverBg: '#DDD6C2' },
}

function actionVariant(action: Action): BtnVariant {
  switch (action.id) {
    case 'approve_medical':
    case 'confirm_quote':
    case 'confirm_date':
      return 'green'
    case 'reopen_case':
    case 'resubmit_to_medical':
      return 'orange'
    case 'submit_to_medical':
      return 'coral'
    case 'add_budget':
    case 'propose_dates':
    case 'assign_surgeon':
      return 'navy'
    default:
      return action.variant === 'danger' ? 'orange' : 'navy'
  }
}

function shortTableLabel(action: Action): string {
  switch (action.id) {
    case 'submit_to_medical':
      return 'Soumettre'
    case 'resubmit_to_medical':
      return 'Renvoyer'
    case 'approve_medical':
      return 'Valider'
    case 'request_more_info':
      return 'Complément'
    case 'reject_medical':
      return 'Refuser'
    case 'confirm_quote':
      return 'Confirmer devis'
    case 'confirm_date':
      return 'Confirmer date'
    case 'reopen_case':
      return 'Réouvrir'
    case 'add_budget':
      return 'Budget'
    case 'propose_dates':
      return 'Dates'
    case 'assign_surgeon':
      return 'Chirurgien'
    default:
      return action.label.length > 22 ? `${action.label.slice(0, 20)}…` : action.label
  }
}

function actionIcon(action: Action) {
  switch (action.id) {
    case 'submit_to_medical':
    case 'resubmit_to_medical':
      return <Send size={13} />
    case 'approve_medical':
    case 'confirm_quote':
    case 'confirm_date':
      return <Check size={13} />
    case 'reopen_case':
      return <RotateCcw size={13} />
    case 'request_more_info':
      return <FilePlus size={13} />
    default:
      return <ChevronRight size={13} />
  }
}

function ActionButton({
  label,
  variant,
  icon,
  href,
}: {
  label: string
  variant: BtnVariant
  icon: React.ReactNode
  href: string
}) {
  const style = BTN_STYLES[variant]

  return (
    <Link
      href={href}
      className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-semibold transition-colors"
      style={{ background: style.bg, color: style.color }}
      onMouseEnter={(event) => {
        event.currentTarget.style.background = style.hoverBg
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.background = style.bg
      }}
      onClick={(event) => event.stopPropagation()}
    >
      {icon}
      <span>{label}</span>
    </Link>
  )
}

export default function PatientRowAction({
  patientId,
  globalStatus,
  userRole,
  quoteAccepted = false,
  dateAccepted = false,
}: PatientRowActionProps) {
  const href = `/dashboard/patient/${patientId}`
  const { primaryAction } = getAvailableActions({
    globalStatus,
    role: userRole,
    quoteAccepted,
    dateAccepted,
  })

  if (primaryAction) {
    return (
      <ActionButton
        label={shortTableLabel(primaryAction)}
        variant={actionVariant(primaryAction)}
        icon={actionIcon(primaryAction)}
        href={href}
      />
    )
  }

  return (
    <Link
      href={href}
      className="text-[13px] font-semibold hover:underline"
      style={{ color: BRAND.coral }}
      onClick={(event) => event.stopPropagation()}
    >
      Ouvrir →
    </Link>
  )
}
