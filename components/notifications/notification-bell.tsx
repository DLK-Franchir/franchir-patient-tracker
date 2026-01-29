'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
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

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    const initUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        console.log('🔔 NotificationBell - User ID:', user.id)
      }
    }
    initUser()
  }, [])

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
        (payload) => {
          console.log('🔔 Nouvelle notification reçue:', payload)
          loadNotifications()
        }
      )
      .subscribe((status) => {
        console.log('🔔 Subscription status:', status)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  async function loadNotifications() {
    if (!userId) return

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(10)

    if (data) {
      setNotifications(data)
    }
  }

  async function markAsRead(id: string) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    loadNotifications()
  }

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id)
    if (notification.patient_id) {
      router.push(`/dashboard/patient/${notification.patient_id}`)
      setIsOpen(false)
    }
  }

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
                      <span className="text-lg shrink-0">
                        {notif.type === 'urgent' ? '🔴' : notif.type === 'success' ? '✅' : 'ℹ️'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900">{notif.title}</p>
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">{notif.message}</p>
                        <p className="text-xs text-gray-400 mt-1">
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
