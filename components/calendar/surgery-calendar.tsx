'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SurgeryCalendar() {
  const supabase = createClient()
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadEvents()
  }, [])

  const loadEvents = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('calendar_events')
      .select(`
        *,
        patients (patient_name),
        surgeons (full_name)
      `)
      .order('event_date', { ascending: true })

    setEvents(data || [])
    setLoading(false)
  }

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case 'proposed_date':
        return 'Date proposée'
      case 'confirmed_date':
        return 'Date confirmée'
      default:
        return type
    }
  }

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'proposed_date':
        return 'bg-amber-100 text-amber-800'
      case 'confirmed_date':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const groupEventsByMonth = () => {
    const grouped: { [key: string]: any[] } = {}
    
    events.forEach(event => {
      const date = new Date(event.event_date)
      const monthKey = date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' })
      
      if (!grouped[monthKey]) {
        grouped[monthKey] = []
      }
      grouped[monthKey].push(event)
    })

    return grouped
  }

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="font-bold text-lg mb-4">Calendrier des chirurgies</h2>
        <p className="text-gray-500 text-sm">Chargement...</p>
      </div>
    )
  }

  const groupedEvents = groupEventsByMonth()

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="font-bold text-lg mb-4">Calendrier des chirurgies</h2>
      
      {events.length === 0 ? (
        <p className="text-gray-500 text-sm">Aucune date de chirurgie planifiée.</p>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedEvents).map(([month, monthEvents]) => (
            <div key={month}>
              <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">
                {month}
              </h3>
              <ul className="space-y-2">
                {monthEvents.map(event => (
                  <li key={event.id} className="border border-gray-200 p-3 rounded-md hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900">
                            {event.patients?.patient_name || 'Patient inconnu'}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${getEventTypeColor(event.event_type)}`}>
                            {getEventTypeLabel(event.event_type)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          {new Date(event.event_date).toLocaleDateString('fr-FR', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </p>
                        {event.surgeons && (
                          <p className="text-xs text-gray-500 mt-1">
                            Chirurgien : {event.surgeons.full_name}
                          </p>
                        )}
                        {event.notes && (
                          <p className="text-xs text-gray-600 mt-1 italic">
                            {event.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
