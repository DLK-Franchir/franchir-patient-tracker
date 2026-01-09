'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function CalendarEventForm({ patientId }: { patientId: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [eventDate, setEventDate] = useState('')
  const [eventType, setEventType] = useState('proposed_date')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      await supabase.from('calendar_events').insert({
        patient_id: patientId,
        event_date: eventDate,
        event_type: eventType,
        notes,
        created_by: session?.user.id
      })

      setEventDate('')
      setNotes('')
      setShowForm(false)
      router.refresh()
    } catch (error) {
      console.error('Error creating event:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700"
      >
        + Ajouter une date de chirurgie
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-gray-50 p-4 rounded-md">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Date de chirurgie
        </label>
        <input
          type="date"
          required
          value={eventDate}
          onChange={e => setEventDate(e.target.value)}
          className="w-full border border-gray-300 rounded-md p-2 focus:ring-purple-500 focus:border-purple-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Type
        </label>
        <select
          value={eventType}
          onChange={e => setEventType(e.target.value)}
          className="w-full border border-gray-300 rounded-md p-2 focus:ring-purple-500 focus:border-purple-500"
        >
          <option value="proposed_date">Date proposée</option>
          <option value="confirmed_date">Date confirmée</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notes (optionnel)
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          className="w-full border border-gray-300 rounded-md p-2 focus:ring-purple-500 focus:border-purple-500"
          rows={2}
          placeholder="Informations complémentaires..."
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-purple-600 text-white py-2 rounded-md hover:bg-purple-700 disabled:opacity-50"
        >
          {loading ? 'Ajout...' : 'Ajouter'}
        </button>
        <button
          type="button"
          onClick={() => setShowForm(false)}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          Annuler
        </button>
      </div>
    </form>
  )
}
