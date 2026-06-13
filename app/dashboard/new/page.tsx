'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'
import DocumentUpload from '@/components/patient/document-upload'

export default function NewPatientPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [summary, setSummary] = useState('')
  const [link, setLink] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [uploadStep, setUploadStep] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_name: name,
          patient_email: email,
          clinical_summary: summary,
          sharepoint_link: link,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la création')
      }

      const patientId: string = data.patientId

      // Upload OPTIONNEL : le patient n'existe qu'après création, on uploade donc
      // dans un second temps vers patients/{id}/. Un échec d'upload ne perd pas
      // le dossier (déjà créé) : on redirige vers la fiche pour réessayer.
      if (files.length > 0 && patientId) {
        setUploadStep(true)
        const formData = new FormData()
        for (const file of files) {
          formData.append('files', file)
        }
        const uploadRes = await fetch(`/api/patients/${patientId}/documents`, {
          method: 'POST',
          body: formData,
        })
        if (!uploadRes.ok) {
          const uploadData = await uploadRes.json().catch(() => ({}))
          alert(
            'Le dossier a été créé, mais l\'envoi des fichiers a échoué : ' +
              (uploadData.error || 'erreur inconnue') +
              '. Vous pourrez les ajouter depuis la fiche patient.'
          )
        }
        router.push(`/dashboard/patient/${patientId}`)
        router.refresh()
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch (err: any) {
      alert('Erreur lors de la création : ' + err.message)
    } finally {
      setLoading(false)
      setUploadStep(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition">
              <Image
                src="/franchir-logo.png"
                alt="FRANCHIR"
                width={44}
                height={44}
                className="h-8 sm:h-11 w-auto"
                priority
              />
            </Link>
            <Link
              href="/dashboard"
              className="text-sm text-gray-700 hover:text-[#2563EB] transition flex items-center gap-2 font-medium px-3 py-2 rounded-lg hover:bg-gray-50"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour au tableau
            </Link>
          </div>
        </div>
      </header>
      <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Nouveau Patient</h1>
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
            <label className="block text-sm font-semibold text-gray-700 mb-2">Email du patient *</label>
            <input
              type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 bg-white text-gray-900 text-base focus:ring-2 focus:ring-[#2563EB] outline-none"
              placeholder="patient@example.com"
            />
            <p className="text-xs text-gray-500 mt-1">
              Le questionnaire est envoyé automatiquement à cette adresse dès la création du dossier
              (revue médicale). Aucun chirurgien n&apos;est requis à ce stade.
            </p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Résumé pathologie / clinique</label>
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
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Imagerie & documents <span className="font-normal text-gray-400">(optionnel)</span>
            </label>
            <DocumentUpload files={files} onChange={setFiles} disabled={loading} />
            <p className="text-xs text-gray-500 mt-2">
              DICOM (imagerie) et PDF / images (comptes rendus, documents). Vous pourrez aussi en
              ajouter plus tard depuis la fiche patient.
            </p>
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
              {uploadStep
                ? 'Envoi des fichiers...'
                : loading
                  ? 'Création...'
                  : 'Créer le dossier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
