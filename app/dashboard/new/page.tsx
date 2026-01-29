'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function NewPatientPage() {
  const [name, setName] = useState('')
  const [summary, setSummary] = useState('')
  const [link, setLink] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { data: { session } } = await supabase.auth.getSession()
    console.log('🔍 Session:', session?.user.id)

    const { data: status, error: statusError } = await supabase
      .from('workflow_statuses')
      .select('id')
      .eq('code', 'prospect_created')
      .single()

    console.log('🔍 Status:', status, 'Error:', statusError)

    const insertData = {
      patient_name: name,
      clinical_summary: summary,
      sharepoint_link: link,
      current_status_id: status?.id,
      created_by: session?.user.id
    }

    console.log('🔍 Insert data:', insertData)

    const { data, error } = await supabase.from('patients').insert(insertData).select()

    console.log('🔍 Insert result:', data, 'Error:', error)

    if (!error) {
      router.push('/dashboard')
      router.refresh()
    } else {
      alert("Erreur lors de la création : " + error.message)
      console.error('❌ Full error:', error)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Nouveau Patient</h1>
          <Link 
            href="/dashboard" 
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour au tableau
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6 bg-white p-4 sm:p-6 lg:p-8 rounded-xl shadow-sm border border-gray-200">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Nom du Patient *</label>
            <input 
              type="text" required value={name} onChange={e => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 bg-white text-gray-900 text-base focus:ring-2 focus:ring-[#2563EB] outline-none"
              placeholder="Ex: Jean Dupont"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Résumé clinique minimal</label>
            <textarea 
              value={summary} onChange={e => setSummary(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 bg-white text-gray-900 text-base focus:ring-2 focus:ring-[#2563EB] outline-none" 
              rows={4}
              placeholder="Résumé des pathologies..."
            />
            <p className="text-xs text-gray-500 mt-1">Le dossier médical complet reste sur SharePoint</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Lien sécurisé SharePoint *</label>
            <input 
              type="url" required value={link} onChange={e => setLink(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 bg-white text-gray-900 text-base focus:ring-2 focus:ring-[#2563EB] outline-none" 
              placeholder="https://sharepoint.com/..."
            />
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
            <Link 
              href="/dashboard" 
              className="w-full sm:w-auto px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-center font-medium min-h-[48px] flex items-center justify-center"
            >
              Annuler
            </Link>
            <button 
              type="submit" 
              disabled={loading}
              className="w-full sm:flex-1 bg-[#2563EB] text-white py-3 rounded-lg font-bold hover:bg-[#1d4ed8] disabled:opacity-50 min-h-[48px]"
            >
              {loading ? 'Création...' : 'Créer le dossier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
