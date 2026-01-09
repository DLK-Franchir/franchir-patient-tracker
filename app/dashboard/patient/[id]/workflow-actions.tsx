'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function WorkflowActions({ patientId, currentStatus }: any) {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const updateStatus = async (statusCode: string) => {
    setLoading(true)
    
    try {
      const { data: status } = await supabase
        .from('workflow_statuses')
        .select('id')
        .eq('code', statusCode)
        .single()

      if (status) {
        await supabase
          .from('patients')
          .update({ current_status_id: status.id })
          .eq('id', patientId)

        router.refresh()
      }
    } catch (error) {
      console.error('Error updating status:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow border-l-4 border-indigo-500">
      <h3 className="font-bold mb-4 text-sm uppercase text-gray-500">Actions disponibles</h3>
      
      <div className="space-y-2">
        {currentStatus.code === 'prospect_created' && (
          <button 
            onClick={() => updateStatus('medical_review')}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50 transition"
          >
            Envoyer en revue médicale
          </button>
        )}

        {currentStatus.code === 'medical_review' && (
          <>
            <button 
              onClick={() => updateStatus('validated_medical')}
              disabled={loading}
              className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:opacity-50 transition"
            >
              ✓ Valider le dossier (Gilles)
            </button>
            <button 
              onClick={() => updateStatus('need_info')}
              disabled={loading}
              className="w-full bg-orange-600 text-white py-2 px-4 rounded hover:bg-orange-700 disabled:opacity-50 transition"
            >
              Demander des informations
            </button>
            <button 
              onClick={() => updateStatus('rejected_medical')}
              disabled={loading}
              className="w-full bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 disabled:opacity-50 transition"
            >
              ✗ Refuser médicalement
            </button>
          </>
        )}

        {currentStatus.code === 'need_info' && (
          <button 
            onClick={() => updateStatus('medical_review')}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50 transition"
          >
            Renvoyer en revue médicale
          </button>
        )}

        {currentStatus.code === 'validated_medical' && (
          <button 
            onClick={() => updateStatus('sent_to_surgeon')}
            disabled={loading}
            className="w-full bg-purple-600 text-white py-2 px-4 rounded hover:bg-purple-700 disabled:opacity-50 transition"
          >
            Envoyer au chirurgien
          </button>
        )}

        {currentStatus.code === 'sent_to_surgeon' && (
          <>
            <button 
              onClick={() => updateStatus('surgeon_accepted')}
              disabled={loading}
              className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:opacity-50 transition"
            >
              ✓ Chirurgien accepte
            </button>
            <button 
              onClick={() => updateStatus('surgeon_rejected')}
              disabled={loading}
              className="w-full bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 disabled:opacity-50 transition"
            >
              ✗ Chirurgien refuse
            </button>
          </>
        )}

        {currentStatus.code === 'surgeon_accepted' && (
          <button 
            onClick={() => updateStatus('quote_issued')}
            disabled={loading}
            className="w-full bg-amber-600 text-white py-2 px-4 rounded hover:bg-amber-700 disabled:opacity-50 transition"
          >
            Émettre un devis
          </button>
        )}

        {currentStatus.code === 'quote_issued' && (
          <>
            <button 
              onClick={() => updateStatus('quote_accepted')}
              disabled={loading}
              className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:opacity-50 transition"
            >
              ✓ Devis accepté
            </button>
            <button 
              onClick={() => updateStatus('quote_rejected')}
              disabled={loading}
              className="w-full bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 disabled:opacity-50 transition"
            >
              ✗ Devis refusé
            </button>
          </>
        )}

        {currentStatus.code === 'quote_accepted' && (
          <button 
            onClick={() => updateStatus('surgery_scheduled')}
            disabled={loading}
            className="w-full bg-purple-600 text-white py-2 px-4 rounded hover:bg-purple-700 disabled:opacity-50 transition"
          >
            Planifier la chirurgie
          </button>
        )}

        {currentStatus.code === 'surgery_scheduled' && (
          <button 
            onClick={() => updateStatus('deposit_received')}
            disabled={loading}
            className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:opacity-50 transition"
          >
            Acompte 30% reçu
          </button>
        )}

        {currentStatus.code === 'deposit_received' && (
          <button 
            onClick={() => updateStatus('confirmed')}
            disabled={loading}
            className="w-full bg-emerald-600 text-white py-2 px-4 rounded hover:bg-emerald-700 disabled:opacity-50 transition"
          >
            Confirmer le dossier
          </button>
        )}

        {currentStatus.is_terminal && (
          <div className="bg-gray-100 text-gray-600 py-3 px-4 rounded text-center text-sm">
            Dossier terminé
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            <span className="font-medium">Statut actuel :</span> {currentStatus.label}
          </p>
        </div>
      </div>
    </div>
  )
}
