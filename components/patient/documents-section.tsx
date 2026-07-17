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
  Play,
} from 'lucide-react'
import DocumentUpload from '@/components/patient/document-upload'
import { PinchZoomImage } from '@/components/ui/pinch-zoom-image'
import { uploadPatientDocuments } from '@/lib/documents/upload-client'
import type { PatientDocument } from '@/lib/documents/patient-documents'
import type { QuestionnaireImagingFile } from '@/lib/integrations/fetch-questionnaire-imaging'
import { isMp4ViewerEnabled } from '@/lib/features/mp4-viewer'
import { groupDicomFilesByMetadata } from '@/lib/imaging/dicom-series-group'
import { filterQuestionnaireImagingAgainstTracker } from '@/lib/imaging/dedupe-imaging-sources'
import type { ViewerSeries } from '@/components/patient/dicom-viewer'

// dwv manipule le DOM + web workers → chargé client-side uniquement, et
// paresseusement (le bundle DICOM n'est livré qu'à l'ouverture d'un DICOM).
const DicomEncapsulatedPdfViewer = dynamic(
  () => import('@/components/patient/dicom-encapsulated-pdf-viewer'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-[400px] text-sm text-white/60">
        Extraction du PDF encapsule…
      </div>
    ),
  },
)

const DicomViewer = dynamic(() => import('@/components/patient/dicom-viewer'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[400px] text-sm text-white/60">
      Initialisation de la visionneuse DICOM…
    </div>
  ),
})

// Repli OpenJPEG pour les JPEG 2000 non décodables par dwv (radios DX).
const DicomJpeg2000FallbackViewer = dynamic(
  () => import('@/components/patient/dicom-jpeg2000-fallback-viewer'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-[400px] text-sm text-white/60">
        Décodage JPEG 2000…
      </div>
    ),
  },
)

const NativeMp4Viewer = dynamic(() => import('@/components/patient/native-mp4-viewer'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[400px] text-sm text-white/60">
      Chargement de la vidéo…
    </div>
  ),
})

type DocumentsSectionProps = {
  patientId: string
  canManage: boolean
}

type ViewerItem =
  | { kind: 'file'; id: string; doc: PatientDocument }
  | { kind: 'dicom-series'; id: string; name: string; urls: string[]; firstUrl: string }
  | { kind: 'dicom-pdf-series'; id: string; name: string; urls: string[]; firstUrl: string }
  | {
      kind: 'questionnaire-file'
      id: string
      name: string
      url: string
      renderType: 'image' | 'pdf' | 'dicom' | 'video' | 'other'
    }
  | { kind: 'questionnaire-dicom-series'; id: string; name: string; urls: string[]; firstUrl: string }
  | {
      kind: 'questionnaire-dicom-pdf-series'
      id: string
      name: string
      urls: string[]
      firstUrl: string
    }

/**
 * Regroupe tous les DICOM en une seule entrée « série » (chargée d'un bloc dans
 * dwv → navigation de coupes instantanée), chaque autre fichier reste isolé.
 */
function buildViewerItems(docs: PatientDocument[]): ViewerItem[] {
  const items: ViewerItem[] = []
  for (const doc of docs) {
    if (doc.renderType !== 'dicom') {
      items.push({ kind: 'file', id: `doc-${doc.id}`, doc })
    }
  }

  for (const series of groupDicomFilesByMetadata(
    docs
      .filter((d) => d.renderType === 'dicom')
      .map((d) => ({
        name: d.fileName,
        url: d.url,
        size: d.sizeBytes,
        sopInstanceUid: d.sopInstanceUid,
        seriesInstanceUid: d.seriesInstanceUid,
        seriesDescription: d.seriesDescription,
        bodyPart: d.bodyPart,
        instanceNumber: d.instanceNumber,
        acquisitionDatetime: d.acquisitionDatetime,
      })),
  )) {
    const first = series.files[0]
    if (!first) continue
    const kind = series.isEncapsulatedPdf ? 'dicom-pdf-series' : 'dicom-series'
    items.push({
      kind,
      id: `${kind}-${series.groupId}`,
      name: series.label,
      urls: series.files.map((f) => f.url),
      firstUrl: first.url,
    })
  }

  return items
}

function questionnaireFileRenderType(
  file: QuestionnaireImagingFile,
): 'image' | 'pdf' | 'dicom' | 'video' | 'other' {
  if (file.type === 'video' && !isMp4ViewerEnabled()) return 'other'
  return file.type
}

function buildQuestionnaireViewerItems(files: QuestionnaireImagingFile[]): ViewerItem[] {
  const items: ViewerItem[] = []
  for (const file of files) {
    if (file.type !== 'dicom') {
      items.push({
        kind: 'questionnaire-file',
        id: `q-file-${file.name}`,
        name: file.name,
        url: file.url,
        renderType: questionnaireFileRenderType(file),
      })
    }
  }

  for (const series of groupDicomFilesByMetadata(
    files
      .filter((f) => f.type === 'dicom')
      .map((f) => ({
        name: f.name,
        url: f.url,
        size: f.size ?? null,
        seriesInstanceUid: f.seriesInstanceUid,
        seriesDescription: f.seriesDescription,
        sopInstanceUid: f.sopInstanceUid,
        instanceNumber: f.instanceNumber,
      })),
  )) {
    const first = series.files[0]
    if (!first) continue
    const kind = series.isEncapsulatedPdf
      ? 'questionnaire-dicom-pdf-series'
      : 'questionnaire-dicom-series'
    items.push({
      kind,
      id: `${kind}-${series.groupId}`,
      name: series.label,
      urls: series.files.map((f) => f.url),
      firstUrl: first.url,
    })
  }

  return items
}

function buildDicomViewerSeries(items: ViewerItem[]): ViewerSeries[] {
  return items
    .filter(
      (item): item is Extract<ViewerItem, { kind: 'dicom-series' | 'questionnaire-dicom-series' }> =>
        item.kind === 'dicom-series' || item.kind === 'questionnaire-dicom-series',
    )
    .map((item) => ({
      id: item.id,
      label: item.name,
      urls: item.urls,
      fileCount: item.urls.length,
    }))
}

function findDicomSeriesIndexById(items: ViewerItem[], selectedId: string): number {
  const dicomItems = items.filter(
    (item) => item.kind === 'dicom-series' || item.kind === 'questionnaire-dicom-series',
  )
  return dicomItems.findIndex((item) => item.id === selectedId)
}

export default function DocumentsSection({ patientId, canManage }: DocumentsSectionProps) {
  const [documents, setDocuments] = useState<PatientDocument[]>([])
  const [questionnaireFiles, setQuestionnaireFiles] = useState<QuestionnaireImagingFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  /** Feedback immédiat avant que dwv peigne la premiere coupe. */
  const [viewerShellBusy, setViewerShellBusy] = useState(false)
  // Séries JPEG 2000 que dwv ne sait pas décoder → rendu via repli OpenJPEG (clé = id série stable).
  const [jpeg2000Fallbacks, setJpeg2000Fallbacks] = useState<Set<string>>(new Set())
  const [showUpload, setShowUpload] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const items = useMemo(() => {
    // Forward patient-images = copie du tracker : masquer les doublons Q.
    const uniqueQuestionnaireFiles = filterQuestionnaireImagingAgainstTracker(
      documents.map((doc) => ({
        fileName: doc.fileName,
        renderType: doc.renderType,
        sizeBytes: doc.sizeBytes,
        seriesInstanceUid: doc.seriesInstanceUid,
        sopInstanceUid: doc.sopInstanceUid,
      })),
      questionnaireFiles,
    )
    return [
      ...buildViewerItems(documents),
      ...buildQuestionnaireViewerItems(uniqueQuestionnaireFiles),
    ]
  }, [documents, questionnaireFiles])

  const dicomViewerSeries = useMemo(() => buildDicomViewerSeries(items), [items])

  const dicomItems = useMemo(
    () =>
      items.filter(
        (item) => item.kind === 'dicom-series' || item.kind === 'questionnaire-dicom-series',
      ),
    [items],
  )

  /** Documents tracker (rapide : table + batch signed URLs). */
  const fetchTrackerDocuments = useCallback(async (): Promise<boolean> => {
    try {
      const docsRes = await fetch(`/api/patients/${patientId}/documents`, { cache: 'no-store' })
      if (!docsRes.ok) {
        throw new Error('Échec du chargement des fichiers')
      }
      const data = await docsRes.json()
      setDocuments(data.documents ?? [])
      setError(null)
      return true
    } catch {
      setError('Impossible de charger les fichiers du patient.')
      return false
    }
  }, [patientId])

  /**
   * Imagerie questionnaire (secondaire). Ne doit jamais bloquer l'ouverture
   * d'une série tracker — le pont Q peut encore être lent sur gros lots.
   */
  const fetchQuestionnaireImaging = useCallback(async () => {
    try {
      const qRes = await fetch(`/api/patients/${patientId}/questionnaires-imaging`, {
        cache: 'no-store',
      })
      if (qRes.ok) {
        const qData = await qRes.json()
        setQuestionnaireFiles(qData.files ?? [])
      } else {
        setQuestionnaireFiles([])
      }
    } catch {
      setQuestionnaireFiles([])
    }
  }, [patientId])

  const fetchDocuments = useCallback(async () => {
    const ok = await fetchTrackerDocuments()
    if (ok) {
      await fetchQuestionnaireImaging()
    }
    setLoading(false)
  }, [fetchTrackerDocuments, fetchQuestionnaireImaging])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const ok = await fetchTrackerDocuments()
      if (cancelled) return
      setLoading(false)
      if (ok) {
        void fetchQuestionnaireImaging()
      }
    })()
    return () => {
      cancelled = true
    }
  }, [fetchTrackerDocuments, fetchQuestionnaireImaging])

  const handleUpload = useCallback(async () => {
    if (pendingFiles.length === 0) return
    setUploading(true)
    try {
      // Upload DIRECT navigateur → Storage (URLs signées) : pas de limite serverless.
      const { skipped } = await uploadPatientDocuments(patientId, pendingFiles)
      setPendingFiles([])
      setShowUpload(false)
      await fetchDocuments()
      if (skipped > 0) {
        alert(
          `${skipped} fichier(s) DICOM déjà présent(s) (même image) ont été ignorés pour éviter les doublons.`,
        )
      }
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

  const resolveItemById = useCallback(
    (id: string) => items.find((entry) => entry.id === id) ?? null,
    [items],
  )

  /**
   * Ouverture immédiate avec les URLs déjà en mémoire (TTL 30 min).
   * Pas de re-fetch pont Q : c'était la cause des freezes « clic → rien ».
   */
  const openViewer = useCallback((id: string) => {
    setViewerShellBusy(true)
    setSelectedId(id)
  }, [])

  const navigateDicomSeries = useCallback(
    (direction: 'next' | 'prev') => {
      if (!selectedId) return
      const current = findDicomSeriesIndexById(items, selectedId)
      const nextIndex =
        direction === 'next'
          ? Math.min(current + 1, dicomItems.length - 1)
          : Math.max(current - 1, 0)
      const nextItem = dicomItems[nextIndex]
      if (!nextItem || nextItem.id === selectedId) return
      setViewerShellBusy(true)
      setSelectedId(nextItem.id)
    },
    [dicomItems, items, selectedId],
  )

  useEffect(() => {
    if (!selectedId) {
      setViewerShellBusy(false)
      return
    }
    // Court pulse UI ; dwv prend ensuite le relais via son overlay loading.
    const t = window.setTimeout(() => setViewerShellBusy(false), 400)
    return () => window.clearTimeout(t)
  }, [selectedId])

  const selectedItem = selectedId ? resolveItemById(selectedId) : null
  const selectedIndex = selectedId ? items.findIndex((item) => item.id === selectedId) : -1
  const selectedName =
    selectedItem === null
      ? ''
      : selectedItem.kind === 'file'
        ? selectedItem.doc.fileName
        : selectedItem.kind === 'questionnaire-file' || selectedItem.kind === 'questionnaire-dicom-series'
          ? selectedItem.name
          : selectedItem.name

  return (
    <section id="patient-documents-section" className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
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
          <DocumentUpload
            files={pendingFiles}
            onChange={setPendingFiles}
            disabled={uploading}
            isUploading={uploading}
          />
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
            Les fichiers DICOM, PDF, images{isMp4ViewerEnabled() ? ' et vidéos MP4' : ''} apparaîtront ici.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item) => {
            const isDicom =
              item.kind === 'dicom-series' ||
              item.kind === 'questionnaire-dicom-series'
            const isDicomPdf =
              item.kind === 'dicom-pdf-series' ||
              item.kind === 'questionnaire-dicom-pdf-series'
            const doc = item.kind === 'file' ? item.doc : null
            const qFile = item.kind === 'questionnaire-file' ? item : null
            const itemKey = item.id
            return (
              <div key={itemKey} className="group relative">
                <button
                  type="button"
                  onClick={() => openViewer(item.id)}
                  aria-label={`Voir ${isDicom || isDicomPdf ? item.name : doc ? doc.fileName : qFile!.name}`}
                  className="block w-full rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
                >
                  {isDicom ? (
                    <div className="w-full h-28 flex flex-col items-center justify-center gap-2 bg-[#0B1020]">
                      <Brain className="w-7 h-7 text-white/90" strokeWidth={1.75} />
                      <span className="rounded bg-indigo-500 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white">
                        DICOM
                      </span>
                    </div>
                  ) : isDicomPdf ? (
                    <div className="w-full h-28 flex flex-col items-center justify-center gap-2 bg-blue-50">
                      <FileText className="w-7 h-7 text-[#2563EB]" strokeWidth={1.75} />
                      <span className="text-[10px] font-bold tracking-wide text-[#2563EB] uppercase">
                        PDF DICOM
                      </span>
                    </div>
                  ) : doc && doc.renderType === 'video' ? (
                    <div className="w-full h-28 flex flex-col items-center justify-center gap-2 bg-[#0B1020]">
                      <Play className="w-7 h-7 text-white/90" strokeWidth={1.75} />
                      <span className="rounded bg-violet-500 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white">
                        MP4
                      </span>
                    </div>
                  ) : qFile && qFile.renderType === 'video' ? (
                    <div className="w-full h-28 flex flex-col items-center justify-center gap-2 bg-[#0B1020]">
                      <Play className="w-7 h-7 text-white/90" strokeWidth={1.75} />
                      <span className="rounded bg-violet-500 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white">
                        MP4
                      </span>
                    </div>
                  ) : doc && doc.renderType === 'image' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={doc.url}
                      alt={doc.fileName}
                      className="w-full h-28 object-cover group-hover:opacity-90 transition"
                    />
                  ) : qFile && qFile.renderType === 'image' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qFile.url}
                      alt={qFile.name}
                      className="w-full h-28 object-cover group-hover:opacity-90 transition"
                    />
                  ) : (
                    <div className="w-full h-28 flex flex-col items-center justify-center gap-2 bg-blue-50">
                      <FileText className="w-7 h-7 text-[#2563EB]" strokeWidth={1.75} />
                      <span className="text-[10px] font-bold tracking-wide text-[#2563EB] uppercase">
                        {doc?.renderType === 'pdf' || qFile?.renderType === 'pdf'
                          ? 'PDF'
                          : doc?.renderType === 'video' || qFile?.renderType === 'video'
                            ? 'MP4'
                            : 'Fichier'}
                      </span>
                    </div>
                  )}
                  <div className="px-2 py-1.5 bg-white">
                    <p className="text-xs font-medium text-gray-700 truncate text-center">
                      {isDicom || isDicomPdf ? item.name : doc ? doc.fileName : qFile!.name}
                    </p>
                    {(qFile ||
                      item.kind === 'questionnaire-dicom-series' ||
                      item.kind === 'questionnaire-dicom-pdf-series') && (
                      <p className="text-[10px] text-emerald-700 truncate text-center">Via questionnaire patient</p>
                    )}
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

      {/* Visionneuse plein écran (DICOM) ou lightbox (autres formats) */}
      {selectedItem &&
        (selectedItem.kind === 'dicom-pdf-series' ||
          selectedItem.kind === 'questionnaire-dicom-pdf-series' ? (
          <div
            className="fixed inset-0 z-50 flex h-dvh max-h-dvh flex-col overflow-hidden bg-[#0B1020]"
            role="dialog"
            aria-modal="true"
            aria-label="Visionneuse PDF encapsule"
            data-testid="dicom-pdf-fullscreen-viewer"
          >
            <DicomEncapsulatedPdfViewer
              urls={selectedItem.urls}
              name={selectedName}
              onClose={() => setSelectedId(null)}
            />
          </div>
        ) : selectedItem.kind === 'dicom-series' ||
          selectedItem.kind === 'questionnaire-dicom-series' ? (
          <div
            className="fixed inset-0 z-50 flex h-dvh max-h-dvh flex-col overflow-hidden bg-[#0B1020]"
            role="dialog"
            aria-modal="true"
            aria-label="Visionneuse DICOM"
            data-testid="dicom-fullscreen-viewer"
          >
            {/* relative host for shell loading overlay */}
            <div className="relative flex h-full min-h-0 w-full flex-col">
            {jpeg2000Fallbacks.has(selectedItem.id) ? (
              <DicomJpeg2000FallbackViewer
                urls={selectedItem.urls}
                name={selectedName}
                fullscreen
                onClose={() => setSelectedId(null)}
              />
            ) : (
              <>
                <DicomViewer
                  urls={selectedItem.urls}
                  name={selectedName}
                  fullscreen
                  series={dicomViewerSeries}
                  activeSeriesIndex={Math.max(0, findDicomSeriesIndexById(items, selectedItem.id))}
                  onNextSeries={() => navigateDicomSeries('next')}
                  onPrevSeries={() => navigateDicomSeries('prev')}
                  onClose={() => setSelectedId(null)}
                  onJpeg2000Unsupported={() => {
                    const seriesId = selectedItem.id
                    setJpeg2000Fallbacks((prev) => {
                      if (prev.has(seriesId)) return prev
                      const next = new Set(prev)
                      next.add(seriesId)
                      return next
                    })
                  }}
                />
                {viewerShellBusy ? (
                  <div
                    className="pointer-events-none absolute inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-[#0B1020]/70"
                    data-testid="dicom-shell-loading"
                    aria-live="polite"
                  >
                    <div
                      className="size-9 animate-spin rounded-full border-2 border-amber-200/30 border-t-amber-100"
                      aria-hidden
                    />
                    <p className="text-sm font-medium text-white/90">Chargement de la série…</p>
                  </div>
                ) : null}
              </>
            )}
            </div>
          </div>
        ) : (
          <div
            className="fixed inset-0 z-50 flex h-dvh max-h-dvh items-stretch justify-center overflow-hidden"
            style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
            onClick={() => setSelectedId(null)}
            role="dialog"
            aria-modal="true"
            aria-label="Visionneuse"
          >
            <div
              className="relative flex h-full w-full max-w-5xl flex-col overflow-hidden bg-[#0B1020] sm:mx-4 sm:my-4 sm:h-auto sm:max-h-[90dvh] sm:rounded-2xl sm:shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-white">{selectedName}</p>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
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
                  {selectedItem.kind === 'questionnaire-file' && (
                    <a
                      href={selectedItem.url}
                      download={selectedItem.name}
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
                        disabled={selectedIndex <= 0}
                        onClick={() => {
                          const prev = items[Math.max(selectedIndex - 1, 0)]
                          if (prev) openViewer(prev.id)
                        }}
                        className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white/70 hover:text-white hover:bg-white/10 transition disabled:opacity-30"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Préc.
                      </button>
                      <span className="text-xs text-white/50">
                        {selectedIndex + 1} / {items.length}
                      </span>
                      <button
                        type="button"
                        disabled={selectedIndex >= items.length - 1}
                        onClick={() => {
                          const next = items[Math.min(selectedIndex + 1, items.length - 1)]
                          if (next) openViewer(next.id)
                        }}
                        className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white/70 hover:text-white hover:bg-white/10 transition disabled:opacity-30"
                      >
                        Suiv.
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    aria-label="Fermer"
                    className="ml-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0B1020]">
                {selectedItem.kind === 'file' && selectedItem.doc.renderType === 'image' ? (
                  <PinchZoomImage
                    src={selectedItem.doc.url}
                    alt={selectedItem.doc.fileName}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : selectedItem.kind === 'questionnaire-file' && selectedItem.renderType === 'image' ? (
                  <PinchZoomImage
                    src={selectedItem.url}
                    alt={selectedItem.name}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : selectedItem.kind === 'file' && selectedItem.doc.renderType === 'video' ? (
                  <NativeMp4Viewer
                    src={selectedItem.doc.url}
                    title={selectedItem.doc.fileName}
                    className="h-full min-h-[50dvh] w-full flex-1 bg-black object-contain sm:min-h-0"
                  />
                ) : selectedItem.kind === 'questionnaire-file' && selectedItem.renderType === 'video' ? (
                  <NativeMp4Viewer
                    src={selectedItem.url}
                    title={selectedItem.name}
                    className="h-full min-h-[50dvh] w-full flex-1 bg-black object-contain sm:min-h-0"
                  />
                ) : selectedItem.kind === 'file' && selectedItem.doc.renderType === 'pdf' ? (
                  <iframe
                    src={selectedItem.doc.url}
                    title={selectedItem.doc.fileName}
                    className="h-full min-h-[50dvh] w-full flex-1 bg-white sm:min-h-0"
                  />
                ) : selectedItem.kind === 'questionnaire-file' && selectedItem.renderType === 'pdf' ? (
                  <iframe
                    src={selectedItem.url}
                    title={selectedItem.name}
                    className="h-full min-h-[50dvh] w-full flex-1 bg-white sm:min-h-0"
                  />
                ) : selectedItem.kind === 'file' ? (
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
                ) : selectedItem.kind === 'questionnaire-file' ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center">
                    <FileText className="w-10 h-10 text-white/70" strokeWidth={1.5} />
                    <p className="text-sm text-white/80">
                      Aperçu non disponible pour ce type de fichier.
                    </p>
                    <a
                      href={selectedItem.url}
                      download={selectedItem.name}
                      className="mt-1 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white bg-white/10 hover:bg-white/20 transition"
                    >
                      <Download className="w-4 h-4" />
                      Télécharger le fichier
                    </a>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ))}
    </section>
  )
}
