'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function QuoteCard({ patientId }: { patientId: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [quote, setQuote] = useState<any>(null)
  const [amount, setAmount] = useState('')
  const [conditions, setConditions] = useState('')
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    loadQuote()
  }, [patientId])

  const loadQuote = async () => {
    const { data } = await supabase
      .from('quotes')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (data) {
      setQuote(data)
      setAmount(data.amount?.toString() || '')
      setConditions(data.conditions || '')
    } else {
      setEditing(true)
    }
  }

  const saveQuote = async () => {
    setLoading(true)
    
    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (quote) {
        await supabase
          .from('quotes')
          .update({
            amount: parseFloat(amount),
            conditions,
            status: 'pending'
          })
          .eq('id', quote.id)
      } else {
        await supabase.from('quotes').insert({
          patient_id: patientId,
          amount: parseFloat(amount),
          conditions,
          status: 'pending',
          created_by: session?.user.id
        })
      }

      await loadQuote()
      setEditing(false)
      router.refresh()
    } catch (error) {
      console.error('Error saving quote:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateQuoteStatus = async (status: string) => {
    if (!quote) return
    
    await supabase
      .from('quotes')
      .update({ status })
      .eq('id', quote.id)

    await loadQuote()
    router.refresh()
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg">Devis</h3>
        {quote && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-sm text-indigo-600 hover:text-indigo-800"
          >
            Modifier
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Montant (€)
            </label>
            <input
              type="number"
              placeholder="Ex: 15000"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full border border-gray-300 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Conditions
            </label>
            <textarea
              placeholder="Conditions du devis, modalités de paiement..."
              value={conditions}
              onChange={e => setConditions(e.target.value)}
              className="w-full border border-gray-300 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500"
              rows={4}
            />
          </div>

          <div className="flex gap-2">
            <button 
              onClick={saveQuote}
              disabled={loading || !amount}
              className="flex-1 bg-indigo-600 text-white py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Enregistrement...' : 'Enregistrer le devis'}
            </button>
            {quote && (
              <button
                onClick={() => {
                  setEditing(false)
                  setAmount(quote.amount?.toString() || '')
                  setConditions(quote.conditions || '')
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
            )}
          </div>
        </div>
      ) : quote ? (
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-500">Montant</p>
            <p className="text-2xl font-bold text-gray-900">
              {parseFloat(quote.amount).toLocaleString('fr-FR')} €
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500 mb-1">Conditions</p>
            <p className="text-gray-700 whitespace-pre-wrap text-sm">
              {quote.conditions || 'Aucune condition spécifiée'}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500 mb-2">Statut</p>
            <div className="flex gap-2">
              {quote.status === 'pending' && (
                <>
                  <button
                    onClick={() => updateQuoteStatus('accepted')}
                    className="flex-1 bg-green-600 text-white py-2 rounded-md hover:bg-green-700 text-sm"
                  >
                    ✓ Accepté
                  </button>
                  <button
                    onClick={() => updateQuoteStatus('rejected')}
                    className="flex-1 bg-red-600 text-white py-2 rounded-md hover:bg-red-700 text-sm"
                  >
                    ✗ Refusé
                  </button>
                </>
              )}
              {quote.status === 'accepted' && (
                <div className="w-full bg-green-100 text-green-800 py-2 px-4 rounded-md text-center text-sm font-medium">
                  ✓ Devis accepté
                </div>
              )}
              {quote.status === 'rejected' && (
                <div className="w-full bg-red-100 text-red-800 py-2 px-4 rounded-md text-center text-sm font-medium">
                  ✗ Devis refusé
                </div>
              )}
            </div>
          </div>

          <p className="text-xs text-gray-400">
            Créé le {new Date(quote.created_at).toLocaleDateString()}
          </p>
        </div>
      ) : (
        <p className="text-gray-500 text-sm">Aucun devis créé pour ce patient.</p>
      )}
    </div>
  )
}
