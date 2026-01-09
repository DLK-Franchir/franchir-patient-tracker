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
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setError('Vous devez être connecté')
        setLoading(false)
        return
      }

      const { data: status } = await supabase
        .from('workflow_statuses')
        .select('id')
        .eq('code', 'prospect_created')
        .single()

      const { data: newPatient, error: insertError } = await supabase
        .from('patients')
        .insert({
          patient_name: name,
          clinical_summary: summary,
          sharepoint_link: link,
          current_status_id: status?.id,
          created_by: session.user.id
        })
        .select()
        .single()

      if (insertError) {
        setError(insertError.message)
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', session.user.id)
        .single()

      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: 'franchir@example.com',
          subject: `Nouveau patient créé : ${name}`,
          html: `
            <h2>Nouveau dossier patient</h2>
            <p><strong>Patient :</strong> ${name}</p>
            <p><strong>Créé par :</strong> ${profile?.full_name || 'Utilisateur'}</p>
            <p><strong>Résumé clinique :</strong></p>
            <p>${summary || 'Aucun résumé fourni'}</p>
            <p><a href="${link}">Voir le dossier SharePoint</a></p>
          `
        })
      })

      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError('Une erreur est survenue')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm mb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-xl font-bold text-gray-900">FRANCHIR - Nouveau Patient</h1>
            <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">
              ← Retour au tableau
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold mb-6">Nouveau Dossier Patient</h2>
        
        <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Nom du Patient *
            </label>
            <input 
              id="name"
              type="text" 
              required 
              value={name} 
              onChange={e => setName(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Ex: Jean Dupont"
            />
          </div>

          <div>
            <label htmlFor="summary" className="block text-sm font-medium text-gray-700">
              Résumé clinique minimal
            </label>
            <textarea 
              id="summary"
              value={summary} 
              onChange={e => setSummary(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500" 
              rows={4}
              placeholder="Brève description de la pathologie et du contexte..."
            />
            <p className="mt-1 text-xs text-gray-500">
              Le dossier médical complet reste sur SharePoint
            </p>
          </div>

          <div>
            <label htmlFor="link" className="block text-sm font-medium text-gray-700">
              Lien sécurisé SharePoint *
            </label>
            <input 
              id="link"
              type="url" 
              required 
              value={link} 
              onChange={e => setLink(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500" 
              placeholder="https://sharepoint.com/..."
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
              {error}
            </div>
          )}

          <div className="flex gap-4">
            <button 
              type="submit" 
              disabled={loading}
              className="flex-1 bg-indigo-600 text-white py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Création...' : 'Créer le dossier'}
            </button>
            <Link 
              href="/dashboard"
              className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-center"
            >
              Annuler
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
