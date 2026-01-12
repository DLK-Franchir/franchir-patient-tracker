'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

type Message = {
  id: string
  kind: 'message' | 'status_change' | 'system'
  title: string | null
  body: string
  author_name: string | null
  author_role: string | null
  created_at: string
  meta: any
}

const kindIcons: Record<string, string> = {
  message: '💬',
  status_change: '🔄',
  system: '⚙️',
}

const kindColors: Record<string, string> = {
  message: 'bg-blue-50 border-blue-200',
  status_change: 'bg-green-50 border-green-200',
  system: 'bg-gray-50 border-gray-200',
}

export default function MessageThread({
  patientId,
  initialMessages,
}: {
  patientId: string
  initialMessages: Message[]
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    const channel = supabase
      .channel(`patient_messages:${patientId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'patient_messages',
          filter: `patient_id=eq.${patientId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [patientId])

  if (messages.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        Aucun message pour l'instant
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`p-4 rounded-lg border ${kindColors[msg.kind] || kindColors.system}`}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl">{kindIcons[msg.kind] || '📝'}</span>
            <div className="flex-1">
              {msg.title && (
                <h4 className="font-semibold text-gray-900 mb-1">{msg.title}</h4>
              )}
              <p className="text-gray-700 text-sm whitespace-pre-wrap">{msg.body}</p>
              <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                {msg.author_name && (
                  <span className="font-medium">
                    {msg.author_name}
                    {msg.author_role && ` (${msg.author_role})`}
                  </span>
                )}
                <span>•</span>
                <time>{new Date(msg.created_at).toLocaleString('fr-FR')}</time>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
