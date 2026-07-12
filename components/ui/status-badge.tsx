import { cn } from '@/lib/utils'

type StatusBadgeVariant = 'default' | 'success' | 'warning' | 'info' | 'danger' | 'neutral'

const VARIANT_CLASSES: Record<StatusBadgeVariant, string> = {
  default: 'bg-blue-100 text-blue-900 border-blue-300',
  success: 'bg-green-100 text-green-900 border-green-400',
  warning: 'bg-amber-100 text-amber-900 border-amber-400',
  info: 'bg-sky-100 text-sky-900 border-sky-300',
  danger: 'bg-red-100 text-red-900 border-red-400',
  neutral: 'bg-slate-100 text-slate-800 border-slate-300',
}

type StatusBadgeProps = {
  label: string
  variant?: StatusBadgeVariant
  /** Couleur hex workflow (prioritaire sur variant). */
  color?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
  /** Libellé complet au survol (défaut : label). */
  title?: string
  /** Empêche les retours à la ligne au milieu des mots. */
  nowrap?: boolean
}

const SIZE_CLASSES = {
  sm: 'text-sm px-2.5 py-0.5',
  md: 'text-base px-3 py-1',
  lg: 'text-lg px-4 py-1.5',
}

export function StatusBadge({
  label,
  variant = 'default',
  color,
  size = 'md',
  className,
  title,
  nowrap = false,
}: StatusBadgeProps) {
  const tooltip = title ?? label

  if (color) {
    return (
      <span
        className={cn(
          'inline-flex max-w-full items-center rounded-full font-bold text-white border-2 border-white/20 shadow-sm',
          nowrap && 'whitespace-nowrap',
          SIZE_CLASSES[size],
          className,
        )}
        style={{ backgroundColor: color }}
        title={tooltip}
      >
        <span className={nowrap ? undefined : 'truncate'}>{label}</span>
      </span>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center rounded-full font-bold border-2',
        nowrap && 'whitespace-nowrap',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      title={tooltip}
    >
      <span className={nowrap ? undefined : 'truncate'}>{label}</span>
    </span>
  )
}

export function questionnaireStatusVariant(
  status: string | null | undefined,
): StatusBadgeVariant {
  if (status === 'completed') return 'success'
  if (status === 'sent') return 'info'
  return 'warning'
}

export function questionnaireStatusLabel(status: string | null | undefined): string {
  if (status === 'completed') return 'Complété'
  if (status === 'sent') return 'Lien envoyé — en attente'
  return 'En attente d\'envoi'
}

/** Libellé court pour colonnes tableau (évite les coupures maladroites). */
export function questionnaireStatusShortLabel(status: string | null | undefined): string {
  if (status === 'completed') return 'Complété'
  if (status === 'sent') return 'Lien envoyé'
  return 'À envoyer'
}
