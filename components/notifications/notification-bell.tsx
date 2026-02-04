'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Notification = {
  id: string
  title: string
  message: string
  type: 'urgent' | 'info' | 'success'
  is_read: boolean
  created_at: string
  patient_id: string | null
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const router = useRouter()

  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const initUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
      }
    }
    initUser()
  }, [supabase])

  const loadNotifications = useCallback(async () => {
    if (!userId) return

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(10)

    if (data) {
      setNotifications(data)
    }
  }, [userId, supabase])

  useEffect(() => {
    if (!userId) return

    loadNotifications()

    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          loadNotifications()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, supabase, loadNotifications])

  const markAsRead = useCallback(async (id: string) => {
    // Optimistic update: remove notification immediately from UI
    setNotifications(prev => prev.filter(n => n.id !== id))

    // Then confirm with server
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)

    // If server update fails, reload notifications to restore state
    if (error) {
      console.error('Failed to mark notification as read:', error)
      loadNotifications()
    }
  }, [supabase, loadNotifications])

  const handleNotificationClick = useCallback((notification: Notification) => {
    markAsRead(notification.id)
    if (notification.patient_id) {
      router.push(`/dashboard/patient/${notification.patient_id}`)
      setIsOpen(false)
    }
  }, [markAsRead, router])

  const unreadCount = notifications.length

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
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
            {unreadCount}
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
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-bold text-gray-900">Notifications</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="sm:hidden p-2 text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-gray-500">Aucune notification</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className="p-4 border-b border-gray-100 hover:bg-gray-50 active:bg-gray-100 cursor-pointer transition"
                    onClick={() => handleNotificationClick(notif)}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-2 h-2 rounded-full mt-2 shrink-0 ${
                          notif.type === 'urgent'
                            ? 'bg-red-500'
                            : notif.type === 'success'
                            ? 'bg-green-500'
                            : 'bg-blue-500'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 mb-1">
                          {notif.title}
                        </p>
                        <p className="text-xs text-gray-600 mb-2">
                          {notif.message}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(notif.created_at).toLocaleString('fr-FR')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
