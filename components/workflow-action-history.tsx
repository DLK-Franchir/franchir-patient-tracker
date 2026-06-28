'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Message } from '@/components/patient/message-thread'

const ACTION_KINDS = new Set(['status_change', 'action', 'system'])

export function isActionLogEntry(msg: Message): boolean {
  return ACTION_KINDS.has(msg.kind)
}

export function filterActionLogEntries(messages: Message[]): Message[] {
  return messages.filter(isActionLogEntry)
}

/** Single realtime subscription for workflow action logs (avoid duplicate channels). */
export function usePatientActionLog(patientId: string, initialMessages: Message[]): Message[] {
  const [messages, setMessages] = useState<Message[]>(() =>
    filterActionLogEntries(initialMessages),
  )

  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    setMessages(filterActionLogEntries(initialMessages))
  }, [initialMessages])

  useEffect(() => {
    const channel = supabase
      .channel(`patient_action_log:${patientId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'patient_messages',
          filter: `patient_id=eq.${patientId}`,
        },
        (payload) => {
          const next = payload.new as Message
          if (!isActionLogEntry(next)) return
          setMessages((prev) =>
            prev.some((m) => m.id === next.id) ? prev : [...prev, next],
          )
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [patientId, supabase])

  return messages
}

interface WorkflowActionHistoryProps {
  messages: Message[]
  assignedSurgeonName?: string | null
}

export function WorkflowActionHistory({
  messages,
  assignedSurgeonName,
}: WorkflowActionHistoryProps) {
  const sortedEntries = useMemo(
    () =>
      [...messages].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [messages],
  )

  return (
    <div className="mt-5 border-t border-gray-200 pt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
        Historique des actions
      </h3>

      <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800">
        <span className="font-semibold">Chirurgien assigné : </span>
        {assignedSurgeonName?.trim() ? assignedSurgeonName : 'Non assigné'}
      </div>

      {sortedEntries.length === 0 ? (
        <p className="text-sm text-gray-500 italic">
          Aucune action enregistrée pour le moment.
        </p>
      ) : (
        <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {sortedEntries.map((entry) => (
            <li
              key={entry.id}
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-gray-900">
                  {entry.title || 'Action'}
                </p>
                <time className="shrink-0 text-xs text-gray-500">
                  {new Date(entry.created_at).toLocaleString('fr-FR', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
              </div>
              <p className="mt-1 text-gray-700 whitespace-pre-wrap text-xs leading-relaxed">
                {entry.body}
              </p>
              {entry.author_name && (
                <p className="mt-1.5 text-xs text-gray-500">
                  Par {entry.author_name}
                  {entry.author_role ? ` (${entry.author_role})` : ''}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
