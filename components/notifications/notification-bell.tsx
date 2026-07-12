'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Notification = {
  id: string
  title: string
  message: string
  type: string
  is_read: boolean
  created_at: string
  patient_id: string | null
}

function formatBadgeCount(count: number): string {
  if (count > 99) return '99+'
  return String(count)
}

function typeDotClass(type: string): string {
  if (type === 'urgent') return 'bg-red-500'
  if (type === 'success') return 'bg-green-500'
  return 'bg-blue-500'
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)
  const router = useRouter()

  const supabase = createClient()

  useEffect(() => {
    const initUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) setUserId(user.id)
    }
    void initUser()
  }, [supabase])

  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) return
      const data = (await res.json()) as {
        unreadCount: number
        notifications: Notification[]
      }
      setUnreadCount(data.unreadCount)
      setNotifications(data.notifications)
    } catch {
      // silencieux — repli au prochain poll
    }
  }, [])

  useEffect(() => {
    if (!userId) return

    void loadNotifications()

    const channel = supabase
      .channel('notifications-inbox')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void loadNotifications()
        },
      )
      .subscribe()

    const pollOnFocus = () => {
      void loadNotifications()
    }
    const pollInterval = window.setInterval(pollOnFocus, 60_000)
    window.addEventListener('focus', pollOnFocus)

    return () => {
      supabase.removeChannel(channel)
      window.clearInterval(pollInterval)
      window.removeEventListener('focus', pollOnFocus)
    }
  }, [userId, supabase, loadNotifications])

  const markAsRead = useCallback(
    async (id: string) => {
      setNotifications((prev) => prev.filter((n) => n.id !== id))
      setUnreadCount((prev) => Math.max(0, prev - 1))

      try {
        const res = await fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        })
        if (!res.ok) {
          void loadNotifications()
          return
        }
        const data = (await res.json()) as { unreadCount: number }
        setUnreadCount(data.unreadCount)
      } catch {
        void loadNotifications()
      }
    },
    [loadNotifications],
  )

  const markAllAsRead = useCallback(async () => {
    if (unreadCount === 0 || markingAll) return
    setMarkingAll(true)
    setNotifications([])
    setUnreadCount(0)

    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      })
      if (!res.ok) void loadNotifications()
    } catch {
      void loadNotifications()
    } finally {
      setMarkingAll(false)
    }
  }, [unreadCount, markingAll, loadNotifications])

  const handleNotificationClick = useCallback(
    (notification: Notification) => {
      void markAsRead(notification.id)
      if (notification.patient_id) {
        router.push(`/dashboard/patient/${notification.patient_id}`)
        setIsOpen(false)
      }
    },
    [markAsRead, router],
  )

  const handleToggleOpen = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev
      if (next) void loadNotifications()
      return next
    })
  }, [loadNotifications])

  return (
    <div className="relative">
      <button
        onClick={handleToggleOpen}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} non lues` : ''}`}
        className="relative p-2 text-gray-600 hover:text-gray-900 transition min-w-[44px] min-h-[44px] flex items-center justify-center"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full min-w-[20px]">
            {formatBadgeCount(unreadCount)}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10 bg-black/20 sm:bg-transparent"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed inset-x-4 top-16 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 w-auto sm:w-96 bg-white rounded-xl shadow-xl border border-gray-200 z-20 max-h-[80vh] sm:max-h-[500px] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center gap-2">
              <h3 className="font-bold text-gray-900 shrink-0">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => void markAllAsRead()}
                    disabled={markingAll}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50 whitespace-nowrap"
                  >
                    {markingAll ? '…' : 'Tout marquer lu'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="sm:hidden p-2 text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-gray-500">Aucune notification non lue</p>
                  <p className="text-xs text-gray-400 mt-2">
                    Le cockpit « Mes actions » reste votre source principale.
                  </p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    role="button"
                    tabIndex={0}
                    className="p-4 border-b border-gray-100 hover:bg-gray-50 active:bg-gray-100 cursor-pointer transition"
                    onClick={() => handleNotificationClick(notif)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleNotificationClick(notif)
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-2 h-2 rounded-full mt-2 shrink-0 ${typeDotClass(notif.type)}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 mb-1">
                          {notif.title}
                        </p>
                        <p className="text-xs text-gray-600 mb-2">{notif.message}</p>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-gray-400">
                            {new Date(notif.created_at).toLocaleString('fr-FR')}
                          </p>
                          {notif.patient_id && (
                            <span className="text-xs text-blue-600 font-medium shrink-0">
                              Voir le dossier →
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            {unreadCount > notifications.length && (
              <div className="p-3 border-t border-gray-100 bg-gray-50 text-center">
                <p className="text-xs text-gray-500">
                  {unreadCount - notifications.length} autre
                  {unreadCount - notifications.length > 1 ? 's' : ''} non lue
                  {unreadCount - notifications.length > 1 ? 's' : ''} — utilisez « Tout marquer lu »
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
