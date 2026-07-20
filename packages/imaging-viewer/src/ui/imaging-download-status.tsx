'use client'

import { Download, Loader2 } from 'lucide-react'
import {
  seriesDownloadProgressMessage,
  studyDownloadProgressMessage,
  type ExportProgressLike,
} from './export-messages'

export type ImagingDownloadStatusProps = {
  open: boolean
  /** Série unique vs étude (éventuellement multi-lots). */
  scope: 'series' | 'study'
  /** Progression étude ; ignoré pour série. */
  progress?: ExportProgressLike | null
  /** Message override (non-PHI). */
  message?: string
  className?: string
}

/**
 * Bannière fixe visible pendant un export ZIP — évite le silence UI
 * (surtout étude chunkée multi-parties).
 */
export function ImagingDownloadStatus({
  open,
  scope,
  progress = null,
  message,
  className = '',
}: ImagingDownloadStatusProps) {
  if (!open) return null

  const label =
    message ??
    (scope === 'study' && progress
      ? studyDownloadProgressMessage(progress)
      : scope === 'study'
        ? studyDownloadProgressMessage({ completed: 0, total: 1, mode: 'single' })
        : seriesDownloadProgressMessage())

  const showParts =
    scope === 'study' &&
    progress &&
    (progress.mode === 'chunked' || progress.mode === 'async') &&
    progress.total > 1

  const pct =
    showParts && progress
      ? Math.min(100, Math.round((progress.completed / progress.total) * 100))
      : null

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-[90] flex justify-center p-3 sm:bottom-4 sm:p-0 ${className}`}
      data-testid="imaging-download-status"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex w-full max-w-md items-center gap-3 rounded-2xl bg-[#0B1020] px-4 py-3 text-white shadow-xl ring-1 ring-white/10 sm:w-auto sm:min-w-[20rem]">
        <span className="relative inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
          <Download className="size-4 opacity-80" aria-hidden />
          <Loader2
            className="absolute -right-1 -top-1 size-3.5 animate-spin text-teal-300"
            aria-hidden
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug">{label}</p>
          {showParts && pct != null ? (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-teal-400 transition-[width] duration-300"
                style={{ width: `${pct}%` }}
                data-testid="imaging-download-status-bar"
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
