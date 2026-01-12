'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { can, type Role } from '@/lib/permissions'

export default function WorkflowActions({ patientId, currentStatus, userRole }: { patientId: string, currentStatus: any, userRole: Role }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [medicalDecision, setMedicalDecision] = useState('')
  const [showMedicalInput, setShowMedicalInput] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<string | null>(null)
  const [localStatus, setLocalStatus] = useState(currentStatus.code)

  const updateStatus = async (statusCode: string, requiresJustification = false) => {
    if (requiresJustification && !medicalDecision.trim()) {
      setShowMedicalInput(true)
      setPendingStatus(statusCode)
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`/api/patients/${patientId}/change-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newStatusCode: statusCode,
          medicalDecision: medicalDecision.trim() || undefined
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        alert(`Erreur: ${data.error}`)
        return
      }

      setMedicalDecision('')
      setShowMedicalInput(false)
      setPendingStatus(null)
      setLocalStatus(statusCode)

      setTimeout(() => {
        router.refresh()
      }, 500)
    } catch (error) {
      console.error('Error updating status:', error)
      alert('Erreur lors de la mise à jour du statut')
    } finally {
      setLoading(false)
    }
  }

  const handleMedicalSubmit = () => {
    if (pendingStatus && medicalDecision.trim()) {
      updateStatus(pendingStatus, false)
    }
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow border-l-4 border-indigo-500">
      <h3 className="font-bold mb-4 text-sm uppercase text-gray-500">Actions disponibles</h3>

      {showMedicalInput && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Message (obligatoire)
          </label>
          <textarea
            value={medicalDecision}
            onChange={(e) => setMedicalDecision(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
            rows={4}
            placeholder="Expliquez votre décision ou les informations nécessaires..."
            autoFocus
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={handleMedicalSubmit}
              disabled={!medicalDecision.trim() || loading}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 transition text-sm font-medium"
            >
              {loading ? 'En cours...' : 'Valider'}
            </button>
            <button
              onClick={() => {
                setShowMedicalInput(false)
                setPendingStatus(null)
                setMedicalDecision('')
              }}
              disabled={loading}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 transition text-sm font-medium"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {localStatus === 'medical_review' && can(userRole, 'VALIDATE_MEDICAL') && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Décision médicale</div>
            <button
              onClick={() => updateStatus('validated_medical', true)}
              disabled={loading}
              className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:opacity-50 transition font-medium"
            >
              ✓ Valider le dossier
            </button>
            <button
              onClick={() => updateStatus('need_info', true)}
              disabled={loading}
              className="w-full bg-orange-600 text-white py-2 px-4 rounded hover:bg-orange-700 disabled:opacity-50 transition font-medium"
            >
              ⚠ Demander des informations
            </button>
            <button
              onClick={() => updateStatus('rejected_medical', true)}
              disabled={loading}
              className="w-full bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 disabled:opacity-50 transition font-medium"
            >
              ✗ Refuser médicalement
            </button>
          </div>
        )}

        {localStatus !== 'rejected_medical' && localStatus !== 'completed' && (
          <div className="space-y-3">
            <div className="bg-gray-50 p-3 rounded border border-gray-200">
              <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Statut actuel</div>
              <div className="text-sm font-medium text-gray-900">{currentStatus.label}</div>
            </div>

            <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Changer le statut</div>

            {can(userRole, 'CREATE_PATIENT') && (
              <>
                {localStatus !== 'medical_review' && (
                  <button
                    onClick={() => updateStatus('medical_review')}
                    disabled={loading}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50 transition font-medium text-sm"
                  >
                    📋 Envoyer en revue médicale
                  </button>
                )}
                {localStatus !== 'need_info' && (
                  <button
                    onClick={() => updateStatus('need_info')}
                    disabled={loading}
                    className="w-full bg-orange-500 text-white py-2 px-4 rounded hover:bg-orange-600 disabled:opacity-50 transition font-medium text-sm"
                  >
                    ⚠ Marquer "Infos supplémentaires nécessaires"
                  </button>
                )}
              </>
            )}

            {can(userRole, 'VALIDATE_MEDICAL') && localStatus !== 'validated_medical' && (
              <button
                onClick={() => updateStatus('validated_medical', true)}
                disabled={loading}
                className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:opacity-50 transition font-medium text-sm"
              >
                ✓ Valider médicalement
              </button>
            )}

            {can(userRole, 'EDIT_QUOTE') && (
              <>
                {localStatus !== 'quote_issued' && (
                  <button
                    onClick={() => updateStatus('quote_issued')}
                    disabled={loading}
                    className="w-full bg-indigo-600 text-white py-2 px-4 rounded hover:bg-indigo-700 disabled:opacity-50 transition font-medium text-sm"
                  >
                    📄 Devis envoyé
                  </button>
                )}
                {localStatus !== 'quote_accepted' && (
                  <button
                    onClick={() => updateStatus('quote_accepted')}
                    disabled={loading}
                    className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:opacity-50 transition font-medium text-sm"
                  >
                    ✓ Devis accepté
                  </button>
                )}
              </>
            )}

            {can(userRole, 'SCHEDULE_SURGERY') && (
              <>
                {localStatus !== 'surgery_scheduled' && (
                  <button
                    onClick={() => updateStatus('surgery_scheduled')}
                    disabled={loading}
                    className="w-full bg-teal-600 text-white py-2 px-4 rounded hover:bg-teal-700 disabled:opacity-50 transition font-medium text-sm"
                  >
                    📅 Chirurgie programmée
                  </button>
                )}
                {localStatus !== 'surgery_done' && (
                  <button
                    onClick={() => updateStatus('surgery_done')}
                    disabled={loading}
                    className="w-full bg-green-700 text-white py-2 px-4 rounded hover:bg-green-800 disabled:opacity-50 transition font-medium text-sm"
                  >
                    ✓ Chirurgie effectuée
                  </button>
                )}
                {localStatus !== 'completed' && (
                  <button
                    onClick={() => updateStatus('completed')}
                    disabled={loading}
                    className="w-full bg-teal-700 text-white py-2 px-4 rounded hover:bg-teal-800 disabled:opacity-50 transition font-medium text-sm"
                  >
                    ✓ Dossier terminé
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {localStatus === 'rejected_medical' && (
          <div className="text-center py-4 px-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            ✗ Dossier refusé médicalement
          </div>
        )}

        {localStatus === 'completed' && (
          <div className="text-center py-4 px-3 bg-teal-50 border border-teal-200 rounded text-teal-700 text-sm">
            ✓ Dossier terminé
          </div>
        )}
      </div>
    </div>
  )
}
