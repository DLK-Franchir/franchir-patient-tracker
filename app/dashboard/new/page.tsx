'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">FRANCHIR - Nouveau Patient</h1>
          <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">← Retour au tableau</Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-xl shadow-sm border border-gray-200">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Nom du Patient *</label>
            <input 
              type="text" required value={name} onChange={e => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Ex: Jean Dupont"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Résumé clinique minimal</label>
            <textarea 
              value={summary} onChange={e => setSummary(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none" 
              rows={4}
              placeholder="Résumé des pathologies..."
            />
            <p className="text-xs text-gray-500 mt-1">Le dossier médical complet reste sur SharePoint</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Lien sécurisé SharePoint *</label>
            <input 
              type="url" required value={link} onChange={e => setLink(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none" 
              placeholder="https://sharepoint.com/..."
            />
          </div>
          <div className="flex gap-4 pt-4">
            <button 
              type="submit" 
              disabled={loading}
              className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Création...' : 'Créer le dossier'}
            </button>
            <Link href="/dashboard" className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
              Annuler
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
