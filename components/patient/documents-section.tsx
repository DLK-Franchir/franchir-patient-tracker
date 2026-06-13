'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  FileText,
  Brain,
  Download,
  Trash2,
  Plus,
  X,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
} from 'lucide-react'
import DocumentUpload from '@/components/patient/document-upload'
import type { PatientDocument } from '@/lib/documents/patient-documents'

// dwv manipule le DOM + web workers → chargé client-side uniquement, et
// paresseusement (le bundle DICOM n'est livré qu'à l'ouverture d'un DICOM).
const DicomViewer = dynamic(() => import('@/components/patient/dicom-viewer'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[400px] text-sm text-white/60">
      Initialisation de la visionneuse DICOM…
    </div>
  ),
})

type DocumentsSectionProps = {
  patientId: string
  canManage: boolean
}

type ViewerItem =
  | { kind: 'file'; doc: PatientDocument }
  | { kind: 'dicom-series'; name: string; urls: string[]; firstUrl: string }

/**
 * Regroupe tous les DICOM en une seule entrée « série » (chargée d'un bloc dans
 * dwv → navigation de coupes instantanée), chaque autre fichier reste isolé.
 */
function buildViewerItems(docs: PatientDocument[]): ViewerItem[] {
  const items: ViewerItem[] = []
  const dicomDocs = docs.filter((d) => d.renderType === 'dicom')
  let seriesInserted = false

  for (const doc of docs) {
    if (doc.renderType !== 'dicom') {
      items.push({ kind: 'file', doc })
      continue
    }
    if (seriesInserted) continue
    seriesInserted = true
    items.push({
      kind: 'dicom-series',
      name: dicomDocs.length > 1 ? `Série DICOM (${dicomDocs.length} coupes)` : doc.fileName,
      urls: dicomDocs.map((d) => d.url),
      firstUrl: doc.url,
    })
  }

  return items
}

export default function DocumentsSection({ patientId, canManage }: DocumentsSectionProps) {
  const [documents, setDocuments] = useState<PatientDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const items = useMemo(() => buildViewerItems(documents), [documents])

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch(`/api/patients/${patientId}/documents`, { cache: 'no-store' })
      if (!res.ok) {
        throw new Error('Échec du chargement des fichiers')
      }
      const data = await res.json()
      setDocuments(data.documents ?? [])
      setError(null)
    } catch {
      setError('Impossible de charger les fichiers du patient.')
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const handleUpload = useCallback(async () => {
    if (pendingFiles.length === 0) return
    setUploading(true)
    try {
      const formData = new FormData()
      for (const file of pendingFiles) {
        formData.append('files', file)
      }
      const res = await fetch(`/api/patients/${patientId}/documents`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Échec de l'upload")
      }
      setPendingFiles([])
      setShowUpload(false)
      await fetchDocuments()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Échec de l'upload")
    } finally {
      setUploading(false)
    }
  }, [pendingFiles, patientId, fetchDocuments])

  const handleDelete = useCallback(
    async (doc: PatientDocument) => {
      if (!confirm(`Supprimer définitivement « ${doc.fileName} » ?`)) return
      setDeletingId(doc.id)
      try {
        const res = await fetch(`/api/patients/${patientId}/documents/${doc.id}`, {
          method: 'DELETE',
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Échec de la suppression')
        }
        await fetchDocuments()
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Échec de la suppression')
      } finally {
        setDeletingId(null)
      }
    },
    [patientId, fetchDocuments],
  )

  const selectedItem = selectedIndex !== null ? items[selectedIndex] : null
  const selectedName =
    selectedItem === null
      ? ''
      : selectedItem.kind === 'file'
        ? selectedItem.doc.fileName
        : selectedItem.name

  return (
    <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900">Imagerie & documents</h2>
        {canManage && !showUpload && (
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[#2563EB] hover:bg-blue-50 rounded-lg transition min-h-[44px]"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Ajouter des fichiers</span>
            <span className="sm:hidden">Ajouter</span>
          </button>
        )}
      </div>

      {canManage && showUpload && (
        <div className="mb-5 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <DocumentUpload files={pendingFiles} onChange={setPendingFiles} disabled={uploading} />
          <div className="flex flex-col-reverse sm:flex-row gap-3 mt-4">
            <button
              type="button"
              onClick={() => {
                setShowUpload(false)
                setPendingFiles([])
              }}
              disabled={uploading}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 text-sm font-medium disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading || pendingFiles.length === 0}
              className="px-4 py-2 bg-[#2563EB] text-white rounded-lg hover:bg-[#1d4ed8] text-sm font-bold disabled:opacity-50"
            >
              {uploading
                ? 'Envoi en cours…'
                : `Envoyer ${pendingFiles.length > 0 ? `(${pendingFiles.length})` : ''}`}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-7 h-7 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-sm text-red-600 py-4">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-8">
          <FileText className="mx-auto mb-3 w-9 h-9 text-gray-300" strokeWidth={1.5} />
          <p className="text-sm font-medium text-gray-500">Aucun fichier pour le moment</p>
          <p className="text-xs text-gray-400 mt-1">
            Les fichiers DICOM, PDF et images apparaîtront ici.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item, index) => {
            const isDicom = item.kind === 'dicom-series'
            const doc = item.kind === 'file' ? item.doc : null
            return (
              <div key={isDicom ? 'dicom-series' : item.doc.id} className="group relative">
                <button
                  type="button"
                  onClick={() => setSelectedIndex(index)}
                  aria-label={`Voir ${isDicom ? item.name : item.doc.fileName}`}
                  className="block w-full rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
                >
                  {isDicom ? (
                    <div className="w-full h-28 flex flex-col items-center justify-center gap-2 bg-[#0B1020]">
                      <Brain className="w-7 h-7 text-white/90" strokeWidth={1.75} />
                      <span className="rounded bg-indigo-500 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white">
                        DICOM
                      </span>
                    </div>
                  ) : doc!.renderType === 'image' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={doc!.url}
                      alt={doc!.fileName}
                      className="w-full h-28 object-cover group-hover:opacity-90 transition"
                    />
                  ) : (
                    <div className="w-full h-28 flex flex-col items-center justify-center gap-2 bg-blue-50">
                      <FileText className="w-7 h-7 text-[#2563EB]" strokeWidth={1.75} />
                      <span className="text-[10px] font-bold tracking-wide text-[#2563EB] uppercase">
                        {doc!.renderType === 'pdf' ? 'PDF' : 'Fichier'}
                      </span>
                    </div>
                  )}
                  <div className="px-2 py-1.5 bg-white">
                    <p className="text-xs font-medium text-gray-700 truncate text-center">
                      {isDicom ? item.name : doc!.fileName}
                    </p>
                  </div>
                </button>
                {canManage && doc && (
                  <button
                    type="button"
                    onClick={() => handleDelete(doc)}
                    disabled={deletingId === doc.id}
                    aria-label={`Supprimer ${doc.fileName}`}
                    className="absolute top-1.5 right-1.5 rounded-full bg-white/90 p-1.5 text-gray-500 shadow-sm hover:text-red-600 hover:bg-white transition disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Lightbox */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
          onClick={() => setSelectedIndex(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Visionneuse"
        >
          <div
            className="relative max-w-5xl w-full mx-4 rounded-2xl overflow-hidden shadow-2xl bg-[#0B1020]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <p className="text-sm font-medium text-white truncate flex-1">{selectedName}</p>
              <div className="flex items-center gap-2 shrink-0">
                {selectedItem.kind === 'file' && (
                  <a
                    href={selectedItem.doc.url}
                    download={selectedItem.doc.fileName}
                    className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white/70 hover:text-white hover:bg-white/10 transition"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Télécharger</span>
                  </a>
                )}
                {items.length > 1 && (
                  <>
                    <button
                      type="button"
                      disabled={selectedIndex === 0}
                      onClick={() => setSelectedIndex((i) => (i !== null ? Math.max(0, i - 1) : 0))}
                      className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white/70 hover:text-white hover:bg-white/10 transition disabled:opacity-30"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Préc.
                    </button>
                    <span className="text-xs text-white/50">
                      {(selectedIndex ?? 0) + 1} / {items.length}
                    </span>
                    <button
                      type="button"
                      disabled={selectedIndex === items.length - 1}
                      onClick={() =>
                        setSelectedIndex((i) => (i !== null ? Math.min(items.length - 1, i + 1) : 0))
                      }
                      className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white/70 hover:text-white hover:bg-white/10 transition disabled:opacity-30"
                    >
                      Suiv.
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedIndex(null)}
                  aria-label="Fermer"
                  className="ml-2 inline-flex items-center justify-center rounded-lg p-1.5 text-white/70 hover:text-white hover:bg-white/10 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-center min-h-[400px] max-h-[75vh] bg-[#0B1020]">
              {selectedItem.kind === 'dicom-series' ? (
                <div className="w-full h-[70vh]">
                  <DicomViewer urls={selectedItem.urls} name={selectedItem.name} />
                </div>
              ) : selectedItem.doc.renderType === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedItem.doc.url}
                  alt={selectedItem.doc.fileName}
                  className="max-w-full max-h-[70vh] object-contain"
                />
              ) : selectedItem.doc.renderType === 'pdf' ? (
                <iframe
                  src={selectedItem.doc.url}
                  title={selectedItem.doc.fileName}
                  className="w-full h-[70vh] bg-white"
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center">
                  <FileText className="w-10 h-10 text-white/70" strokeWidth={1.5} />
                  <p className="text-sm text-white/80">
                    Aperçu non disponible pour ce type de fichier.
                  </p>
                  <a
                    href={selectedItem.doc.url}
                    download={selectedItem.doc.fileName}
                    className="mt-1 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white bg-white/10 hover:bg-white/20 transition"
                  >
                    <Download className="w-4 h-4" />
                    Télécharger le fichier
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
