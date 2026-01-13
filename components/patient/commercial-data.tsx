'use client'

import { useState } from 'react'

interface CommercialDataProps {
  patientId: string
  initialQuoteAmount?: number | null
  initialProposedDate?: string | null
  canEdit: boolean
}

export default function CommercialData({
  patientId,
  initialQuoteAmount,
  initialProposedDate,
  canEdit,
}: CommercialDataProps) {
  const [isEditingQuote, setIsEditingQuote] = useState(false)
  const [isEditingDate, setIsEditingDate] = useState(false)
  const [quoteAmount, setQuoteAmount] = useState(initialQuoteAmount?.toString() || '')
  const [proposedDate, setProposedDate] = useState(
    initialProposedDate ? new Date(initialProposedDate).toISOString().split('T')[0] : ''
  )
  const [isSaving, setIsSaving] = useState(false)

  const handleSaveQuote = async () => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/patients/${patientId}/commercial-data`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteAmount: parseFloat(quoteAmount) || null }),
      })

      if (!response.ok) throw new Error('Failed to save quote')

      setIsEditingQuote(false)
      window.location.reload()
    } catch (error) {
      console.error('Error saving quote:', error)
      alert('Erreur lors de la sauvegarde du devis')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveDate = async () => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/patients/${patientId}/commercial-data`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposedDate: proposedDate ? new Date(proposedDate).toISOString() : null }),
      })

      if (!response.ok) throw new Error('Failed to save date')

      setIsEditingDate(false)
      window.location.reload()
    } catch (error) {
      console.error('Error saving date:', error)
      alert('Erreur lors de la sauvegarde de la date')
    } finally {
      setIsSaving(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('fr-FR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-900">Budget indicatif</label>
          {canEdit && !isEditingQuote && (
            <button
              onClick={() => setIsEditingQuote(true)}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Modifier
            </button>
          )}
        </div>

        {isEditingQuote ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={quoteAmount}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuoteAmount(e.target.value)}
              placeholder="Montant en €"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isSaving}
            />
            <button
              onClick={handleSaveQuote}
              disabled={isSaving}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              Enregistrer
            </button>
            <button
              onClick={() => {
                setIsEditingQuote(false)
                setQuoteAmount(initialQuoteAmount?.toString() || '')
              }}
              disabled={isSaving}
              className="px-3 py-2 text-gray-600 hover:text-gray-700"
            >
              Annuler
            </button>
          </div>
        ) : (
          <p className="text-lg font-semibold text-gray-900">
            {quoteAmount ? `${parseFloat(quoteAmount).toLocaleString('fr-FR')} €` : 'Non renseigné'}
          </p>
        )}
      </div>

      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-900">Date proposée</label>
          {canEdit && !isEditingDate && (
            <button
              onClick={() => setIsEditingDate(true)}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Modifier
            </button>
          )}
        </div>

        {isEditingDate ? (
          <div className="space-y-2">
            <input
              type="date"
              value={proposedDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProposedDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isSaving}
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveDate}
                disabled={isSaving}
                className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                Enregistrer
              </button>
              <button
                onClick={() => {
                  setIsEditingDate(false)
                  setProposedDate(initialProposedDate ? new Date(initialProposedDate).toISOString().split('T')[0] : '')
                }}
                disabled={isSaving}
                className="px-3 py-2 text-gray-600 hover:text-gray-700"
              >
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <p className="text-lg font-semibold text-gray-900">
            {proposedDate ? formatDate(proposedDate) : 'Non renseignée'}
          </p>
        )}
      </div>
    </div>
  )
}
