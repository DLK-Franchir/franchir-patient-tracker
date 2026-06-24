'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Download, X } from 'lucide-react'
import { fetchEncapsulatedPdfBlobUrl } from '@/lib/imaging/dicom-content'

type DicomEncapsulatedPdfViewerProps = {
  urls: string[]
  name: string
  activeIndex?: number
  onClose?: () => void
}

export default function DicomEncapsulatedPdfViewer({
  urls,
  name,
  activeIndex = 0,
  onClose,
}: DicomEncapsulatedPdfViewerProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const sourceUrl = urls[Math.max(0, Math.min(activeIndex, urls.length - 1))] ?? urls[0]

  useEffect(() => {
    if (!sourceUrl) return
    let revoked: string | null = null
    let cancelled = false

    setLoading(true)
    setError(null)
    setPdfUrl(null)

    void fetchEncapsulatedPdfBlobUrl(sourceUrl)
      .then((blobUrl) => {
        if (cancelled) {
          URL.revokeObjectURL(blobUrl)
          return
        }
        revoked = blobUrl
        setPdfUrl(blobUrl)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Impossible d extraire le PDF')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      if (revoked) URL.revokeObjectURL(revoked)
    }
  }, [sourceUrl])

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[#0B1020]" data-testid="dicom-pdf-viewer">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{name}</p>
          <p className="text-[11px] text-white/50">
            PDF encapsule DICOM (modality DOC) — {urls.length} fichier{urls.length > 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {sourceUrl ? (
            <a
              href={sourceUrl}
              download={name}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white"
            >
              <Download className="size-4" />
              DICOM source
            </a>
          ) : null}
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="rounded-lg p-2 text-white/80 hover:bg-white/10"
            >
              <X className="size-5" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 bg-white">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0B1020]">
            <div className="size-8 animate-spin rounded-full border-2 border-amber-200/30 border-t-amber-100" />
          </div>
        ) : null}
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0B1020] px-6 text-center">
            <AlertTriangle className="size-8 text-white/80" />
            <p className="text-sm font-medium text-white">Format non supporte : PDF encapsule</p>
            <p className="text-xs text-white/50">{error}</p>
          </div>
        ) : null}
        {pdfUrl && !error ? (
          <iframe src={pdfUrl} title={name} className="h-full w-full border-0" />
        ) : null}
      </div>
    </div>
  )
}
