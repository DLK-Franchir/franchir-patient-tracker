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
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-900">Budget indicatif</label>
          {canEdit && !isEditingQuote && (
            <button
              onClick={() => setIsEditingQuote(true)}
              className="text-sm text-[#2563EB] hover:text-[#1d4ed8] font-medium py-1 px-2 min-h-[36px]"
            >
              Modifier
            </button>
          )}
        </div>

        {isEditingQuote ? (
          <div className="space-y-3">
            <input
              type="number"
              value={quoteAmount}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuoteAmount(e.target.value)}
              placeholder="Montant en €"
              className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB] text-base"
              disabled={isSaving}
            />
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleSaveQuote}
                disabled={isSaving}
                className="flex-1 px-4 py-3 bg-[#2563EB] text-white rounded-lg hover:bg-[#1d4ed8] disabled:opacity-50 font-medium min-h-[48px]"
              >
                Enregistrer
              </button>
              <button
                onClick={() => {
                  setIsEditingQuote(false)
                  setQuoteAmount(initialQuoteAmount?.toString() || '')
                }}
                disabled={isSaving}
                className="px-4 py-3 text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-lg min-h-[48px]"
              >
                Annuler
              </button>
            </div>
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
              className="text-sm text-[#2563EB] hover:text-[#1d4ed8] font-medium py-1 px-2 min-h-[36px]"
            >
              Modifier
            </button>
          )}
        </div>

        {isEditingDate ? (
          <div className="space-y-3">
            <input
              type="date"
              value={proposedDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProposedDate(e.target.value)}
              className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB] text-base"
              disabled={isSaving}
            />
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleSaveDate}
                disabled={isSaving}
                className="flex-1 px-4 py-3 bg-[#2563EB] text-white rounded-lg hover:bg-[#1d4ed8] disabled:opacity-50 font-medium min-h-[48px]"
              >
                Enregistrer
              </button>
              <button
                onClick={() => {
                  setIsEditingDate(false)
                  setProposedDate(initialProposedDate ? new Date(initialProposedDate).toISOString().split('T')[0] : '')
                }}
                disabled={isSaving}
                className="px-4 py-3 text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-lg min-h-[48px]"
              >
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <p className="text-lg font-semibold text-gray-900" suppressHydrationWarning>
            {proposedDate ? formatDate(proposedDate) : 'Non renseignée'}
          </p>
        )}
      </div>
    </div>
  )
}
