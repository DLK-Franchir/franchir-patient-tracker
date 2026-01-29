'use client'

import { useState } from 'react'

export default function MessageComposer({ patientId, topic = 'medical' }: { patientId: string; topic?: string }) {
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!message.trim()) {
      setError('Le message ne peut pas être vide')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/patients/${patientId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim(), topic }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de l\'envoi du message')
      }

      setMessage('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        disabled={loading}
        rows={3}
        placeholder="Écrire un message..."
        className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563EB] focus:border-transparent text-base text-gray-900"
      />

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#2563EB] text-white py-3 px-4 rounded-lg hover:bg-[#1d4ed8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium min-h-[48px]"
      >
        {loading ? 'Envoi...' : 'Envoyer'}
      </button>
    </form>
  )
}
