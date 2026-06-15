'use client'

import { useState } from 'react'
import { UserRound } from 'lucide-react'
import type { SurgeonOption } from '@/components/workflow-actions'

type AssignedSurgeon = {
  id: string
  full_name: string
  email?: string | null
}

interface SurgeonAssignmentCardProps {
  patientId: string
  surgeons: SurgeonOption[]
  assignedSurgeon: AssignedSurgeon | null
  canManage: boolean
  onAssigned?: (surgeon: AssignedSurgeon) => void
}

export default function SurgeonAssignmentCard({
  patientId,
  surgeons,
  assignedSurgeon,
  canManage,
  onAssigned,
}: SurgeonAssignmentCardProps) {
  const [selectedId, setSelectedId] = useState(assignedSurgeon?.id ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedSurgeon, setSavedSurgeon] = useState<AssignedSurgeon | null>(assignedSurgeon)

  const hasChanges = selectedId !== (savedSurgeon?.id ?? '')

  const handleSave = async () => {
    if (!selectedId) {
      setError('Sélectionnez un chirurgien.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/patients/${patientId}/assign-surgeon`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ surgeonId: selectedId }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Échec de l\'assignation')
      }

      const next: AssignedSurgeon = data.assignedSurgeon
      setSavedSurgeon(next)
      onAssigned?.(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <UserRound className="w-4 h-4 text-gray-500 shrink-0" />
        <h3 className="text-sm font-semibold text-gray-900">Chirurgien responsable</h3>
      </div>

      {savedSurgeon ? (
        <p className="text-sm text-gray-800 font-medium">{savedSurgeon.full_name}</p>
      ) : (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          Aucun chirurgien assigné — le dossier n&apos;apparaît pas encore sur le tableau chirurgien.
        </p>
      )}

      {canManage && (
        <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
          {surgeons.length === 0 ? (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              Aucun chirurgien dans l&apos;annuaire. Ajoutez des chirurgiens actifs (avec email) dans
              Supabase pour permettre l&apos;assignation.
            </p>
          ) : (
            <>
              <label htmlFor={`surgeon-select-${patientId}`} className="sr-only">
                Chirurgien responsable
              </label>
              <select
                id={`surgeon-select-${patientId}`}
                value={selectedId}
                onChange={(e) => {
                  setSelectedId(e.target.value)
                  setError(null)
                }}
                disabled={loading}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-[#2563EB] outline-none disabled:opacity-50"
              >
                <option value="">— Sélectionner un chirurgien —</option>
                {surgeons.map((surgeon) => (
                  <option key={surgeon.id} value={surgeon.id}>
                    {surgeon.full_name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleSave}
                disabled={loading || !hasChanges || !selectedId}
                className="w-full text-sm bg-[#2563EB] text-white px-3 py-2 rounded-md font-medium hover:bg-[#1d4ed8] disabled:opacity-50 transition"
              >
                {loading ? 'Enregistrement…' : savedSurgeon ? 'Modifier le chirurgien' : 'Assigner le chirurgien'}
              </button>
            </>
          )}
          {error && (
            <p className="text-xs text-red-600" role="alert">
              {error}
            </p>
          )}
          <p className="text-xs text-gray-500">
            L&apos;assignation synchronise le dossier vers l&apos;app questionnaires (tableau chirurgien).
          </p>
        </div>
      )}
    </div>
  )
}
