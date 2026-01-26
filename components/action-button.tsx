'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle2, AlertCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ActionStatus = 'urgent' | 'available' | 'completed' | 'disabled'

interface ActionButtonProps {
  label: string
  status?: ActionStatus
  statusMessage?: string
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  className?: string
}

const statusConfig = {
  urgent: {
    badge: 'Requis',
    badgeClass: 'bg-red-100 text-red-700 border-red-300',
    buttonClass: 'border-red-300 hover:border-red-400 bg-red-50 hover:bg-red-100',
    icon: AlertCircle,
    iconClass: 'text-red-600'
  },
  available: {
    badge: 'Disponible',
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-300',
    buttonClass: 'border-blue-300 hover:border-blue-400 bg-blue-50 hover:bg-blue-100',
    icon: Clock,
    iconClass: 'text-blue-600'
  },
  completed: {
    badge: 'Complété',
    badgeClass: 'bg-green-100 text-green-700 border-green-300',
    buttonClass: 'border-green-300 bg-green-50',
    icon: CheckCircle2,
    iconClass: 'text-green-600'
  },
  disabled: {
    badge: 'Futur',
    badgeClass: 'bg-gray-100 text-gray-500 border-gray-300',
    buttonClass: 'border-gray-200 bg-gray-50',
    icon: Clock,
    iconClass: 'text-gray-400'
  }
}

export function ActionButton({
  label,
  status = 'available',
  statusMessage,
  variant = 'outline',
  onClick,
  disabled = false,
  loading = false,
  className
}: ActionButtonProps) {
  const config = statusConfig[status]
  const Icon = config.icon
  const isDisabled = disabled || status === 'disabled' || status === 'completed'

  return (
    <div className="space-y-2">
      <Button
        onClick={onClick}
        disabled={isDisabled || loading}
        variant={variant}
        className={cn(
          'w-full justify-start gap-3 transition-all duration-200',
          config.buttonClass,
          isDisabled && 'opacity-60 cursor-not-allowed',
          className
        )}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Icon className={cn('h-4 w-4', config.iconClass)} />
        )}
        <span className="flex-1 text-left">{label}</span>
        <Badge variant="outline" className={cn('text-xs', config.badgeClass)}>
          {config.badge}
        </Badge>
      </Button>
      {statusMessage && (
        <p className="text-xs text-muted-foreground px-2">{statusMessage}</p>
      )}
    </div>
  )
}
