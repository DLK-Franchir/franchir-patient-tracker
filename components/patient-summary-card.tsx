'use client'

import { useState } from 'react'
import { ExternalLink, Edit2, Save, X } from 'lucide-react'
import { type GlobalStatus, type UserRole } from '@/lib/workflow-v2'

interface PatientSummaryCardProps {
  patientName: string
  clinicalSummary: string | null
  sharepointLink: string | null
  globalStatus: GlobalStatus
  userRole: UserRole
  onUpdate: (summary: string, link: string) => Promise<void>
}

export default function PatientSummaryCard({
  patientName,
  clinicalSummary,
  sharepointLink,
  globalStatus,
  userRole,
  onUpdate,
}: PatientSummaryCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editSummary, setEditSummary] = useState(clinicalSummary || '')
  const [editLink, setEditLink] = useState(sharepointLink || '')
  const [loading, setLoading] = useState(false)

  const canEdit = userRole === 'marcel' && globalStatus === 'medical_more_info'

  const handleSave = async () => {
    setLoading(true)
    try {
      await onUpdate(editSummary, editLink)
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to update:', error)
      alert('Erreur lors de la mise à jour')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setEditSummary(clinicalSummary || '')
    setEditLink(sharepointLink || '')
    setIsEditing(false)
  }

  return (
    <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Fiche Patient</h2>
        {canEdit && !isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-[#2563EB] hover:bg-blue-50 rounded-lg transition"
          >
            <Edit2 className="w-4 h-4" />
            Modifier
          </button>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nom du patient</label>
          <p className="text-base font-semibold text-gray-900">{patientName}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Résumé clinique</label>
          {isEditing ? (
            <textarea
              value={editSummary}
              onChange={(e) => setEditSummary(e.target.value)}
              rows={6}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
              placeholder="Saisissez le résumé clinique..."
            />
          ) : (
            <div className="prose prose-sm max-w-none text-gray-700 bg-gray-50 rounded-lg p-4">
              {clinicalSummary || (
                <p className="text-gray-400 italic">Aucun résumé clinique fourni.</p>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Lien SharePoint</label>
          {isEditing ? (
            <input
              type="url"
              value={editLink}
              onChange={(e) => setEditLink(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
              placeholder="https://..."
            />
          ) : sharepointLink ? (
            <a
              href={sharepointLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#2563EB] text-white rounded-lg hover:bg-[#1d4ed8] transition font-medium"
            >
              <ExternalLink className="w-4 h-4" />
              Ouvrir le dossier SharePoint
            </a>
          ) : (
            <p className="text-gray-400 italic text-sm">Aucun lien SharePoint fourni.</p>
          )}
        </div>

        {isEditing && (
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] text-white rounded-lg hover:bg-[#1d4ed8] transition font-medium disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <button
              onClick={handleCancel}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
            >
              <X className="w-4 h-4" />
              Annuler
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
