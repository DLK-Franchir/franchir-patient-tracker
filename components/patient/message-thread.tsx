'use client'

type MessageMeta = {
  old_status?: string
  new_status?: string
  [key: string]: unknown
}

export type Message = {
  id: string
  kind: 'message' | 'status_change' | 'system' | 'action'
  title: string | null
  body: string
  author_name: string | null
  author_role: string | null
  created_at: string
  topic?: string | null
  meta?: MessageMeta
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
  action: 'bg-purple-50 border-purple-200',
}

export default function MessageThread({
  initialMessages,
}: {
  patientId: string
  initialMessages: Message[]
}) {
  if (initialMessages.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        Aucun message pour l'instant
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {initialMessages.map((msg) => (
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
