'use client'

import { useState } from 'react'

interface SurgeryDateBannerProps {
  confirmedDate: string | null
  surgeonName: string | null
  proposedDate?: string | null
  isAdmin: boolean
  patientId: string
  onAdminUpdate?: (date: string, surgeon: string) => Promise<void>
}

export default function SurgeryDateBanner({
  confirmedDate,
  surgeonName,
  proposedDate,
  isAdmin,
  patientId,
  onAdminUpdate,
}: SurgeryDateBannerProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editDate, setEditDate] = useState(confirmedDate?.split('T')[0] ?? '')
  const [editSurgeon, setEditSurgeon] = useState(surgeonName ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  const handleSave = async () => {
    if (!editDate || !onAdminUpdate) return
    setIsSaving(true)
    setError(null)
    try {
      await onAdminUpdate(editDate, editSurgeon)
      setIsEditing(false)
    } catch {
      setError('Erreur lors de la mise à jour.')
    } finally {
      setIsSaving(false)
    }
  }

  if (!confirmedDate && !proposedDate) return null

  if (confirmedDate) {
    return (
      <div className="relative rounded-2xl border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-indigo-50 p-6 shadow-md">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex items-center gap-2">
            <span className="text-3xl">📅</span>
            <h3 className="text-lg font-bold text-purple-900">Date d'intervention confirmée</h3>
          </div>
          {isEditing && isAdmin ? (
            <div className="mt-4 w-full max-w-sm space-y-3">
              <div>
                <label className="block text-xs font-semibold text-purple-800 mb-1">Date</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={e => setEditDate(e.target.value)}
                  className="w-full rounded-lg border border-purple-300 px-3 py-2 text-sm text-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-purple-800 mb-1">
                  Chirurgien
                </label>
                <input
                  type="text"
                  value={editSurgeon}
                  onChange={e => setEditSurgeon(e.target.value)}
                  placeholder="Nom du chirurgien"
                  className="w-full rounded-lg border border-purple-300 px-3 py-2 text-sm text-gray-900"
                />
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex gap-2 justify-center">
                <button
                  onClick={handleSave}
                  disabled={isSaving || !editDate}
                  className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-60"
                >
                  {isSaving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-4xl font-extrabold text-purple-800 mt-2">
                {formatDate(confirmedDate)}
              </p>
              {surgeonName && (
                <p className="mt-1 text-base font-semibold text-indigo-700">
                  Chirurgien : {surgeonName}
                </p>
              )}
              <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-800">
                🔒 Date confirmée — lecture seule
              </span>
              {isAdmin && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="mt-2 text-xs text-purple-600 underline hover:text-purple-800"
                >
                  Modifier (admin)
                </button>
              )}
            </>
          )}
        </div>
        <p className="sr-only">ID dossier: {patientId}</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
      <div className="flex items-start gap-3">
        <span className="text-xl">🗓️</span>
        <div>
          <p className="text-sm font-semibold text-blue-900">Date d'intervention proposée</p>
          <p className="mt-1 text-base font-bold text-blue-800">{formatDate(proposedDate!)}</p>
          <p className="mt-1 text-xs text-blue-600">
            En attente de confirmation — non modifiable ici.
          </p>
        </div>
      </div>
    </div>
  )
}
