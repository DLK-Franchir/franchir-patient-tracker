'use client'

import { createContext, useContext, useState, ReactNode, useCallback } from 'react'
import { AlertCircle, CheckCircle2, Info, XCircle } from 'lucide-react'

interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  duration?: number
}

interface NotificationContextType {
  notifications: Notification[]
  addNotification: (notification: Omit<Notification, 'id'>) => void
  removeNotification: (id: string) => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const addNotification = useCallback(
    (notification: Omit<Notification, 'id'>) => {
      const id = Math.random().toString(36).substring(7)
      const newNotification = { ...notification, id }

      setNotifications(prev => [...prev, newNotification])

      const duration = notification.duration || 5000
      setTimeout(() => {
        removeNotification(id)
      }, duration)
    },
    [removeNotification]
  )

  const styles = {
    success: 'border-green-200 bg-green-50 text-green-900',
    error: 'border-red-200 bg-red-50 text-red-900',
    warning: 'border-yellow-200 bg-yellow-50 text-yellow-900',
    info: 'border-blue-200 bg-blue-50 text-blue-900',
  }

  const icons = {
    success: CheckCircle2,
    error: XCircle,
    warning: AlertCircle,
    info: Info,
  }

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification }}>
      {children}
      <div className="fixed right-3 top-3 z-[100] flex w-[calc(100%-1.5rem)] max-w-sm flex-col gap-3 sm:right-6 sm:top-6 sm:w-full">
        {notifications.map(notification => {
          const Icon = icons[notification.type]
          return (
            <div
              key={notification.id}
              role="status"
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg ${styles[notification.type]}`}
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="flex-1 text-sm font-medium">{notification.message}</p>
              <button
                type="button"
                onClick={() => removeNotification(notification.id)}
                className="rounded-md p-1 opacity-70 transition hover:bg-white/60 hover:opacity-100"
                aria-label="Fermer la notification"
              >
                ×
              </button>
            </div>
          )
        })}
      </div>
    </NotificationContext.Provider>
  )
}

export function useNotification() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider')
  }
  return context
}
