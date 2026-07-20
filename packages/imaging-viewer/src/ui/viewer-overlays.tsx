'use client'

import { AlertTriangle } from 'lucide-react'
import { VIEWER_BG } from './messages'

export function DicomViewportLoadingOverlay({
  message,
  progress,
}: {
  message: string
  progress?: number
}) {
  return (
    <div
      className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3"
      style={{ backgroundColor: `${VIEWER_BG}d9` }}
      data-testid="dicom-viewport-overlay"
    >
      <div
        className="size-8 animate-spin rounded-full border-2 border-amber-200/30 border-t-amber-100"
        aria-hidden
      />
      <p className="max-w-xs px-4 text-center text-sm font-medium text-white/90">{message}</p>
      {typeof progress === 'number' && progress > 0 ? (
        <p className="text-xs tabular-nums text-white/50">{progress} %</p>
      ) : null}
    </div>
  )
}

export function DicomViewportErrorOverlay({
  errorMessage,
  warning,
  downloadHref,
  downloadName,
}: {
  errorMessage?: string | null
  warning?: string | null
  downloadHref?: string
  downloadName?: string
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
      <AlertTriangle className="size-8 text-white/80" strokeWidth={1.75} aria-hidden="true" />
      <p className="text-sm font-medium text-white">Impossible d&apos;afficher ce DICOM</p>
      <p className="text-xs text-white/50">
        {errorMessage ??
          'Le fichier est peut-être corrompu, dans un format compressé non pris en charge, ou le lien sécurisé a expiré.'}
      </p>
      {warning ? <p className="text-xs text-amber-200/80">{warning}</p> : null}
      {downloadHref ? (
        <a
          href={downloadHref}
          download={downloadName}
          className="mt-2 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20"
        >
          Télécharger le fichier
        </a>
      ) : null}
    </div>
  )
}
