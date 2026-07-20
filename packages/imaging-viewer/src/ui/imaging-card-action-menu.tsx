'use client'

import { useEffect, useId, useRef, useState, type SyntheticEvent } from 'react'
import { Download, MoreVertical, Trash2 } from 'lucide-react'

export type ImagingCardActionMenuProps = {
  /** Accessible name of the card item (non-PHI). */
  itemLabel: string
  canDownload?: boolean
  canDelete?: boolean
  downloadBusy?: boolean
  deleteBusy?: boolean
  onDownload?: () => void
  onDelete?: () => void
  /** Optional class on the absolute action host (top-right of card). */
  className?: string
}

/**
 * Actions carte imagerie — desktop : rangée icônes + labels tooltips ;
 * mobile : menu overflow « ⋯ » (bottom-sheet style panel) pour gros targets.
 * Évite la poubelle minuscule superposée sur la vignette.
 */
export function ImagingCardActionMenu({
  itemLabel,
  canDownload = true,
  canDelete = false,
  downloadBusy = false,
  deleteBusy = false,
  onDownload,
  onDelete,
  className = '',
}: ImagingCardActionMenuProps) {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!canDownload && !canDelete) return null

  const stop = (e: SyntheticEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <div
      ref={rootRef}
      className={`absolute right-1.5 top-1.5 z-10 flex items-center gap-1 ${className}`}
      data-testid="imaging-card-action-menu"
      onClick={stop}
      onKeyDown={stop}
    >
      {/* Desktop / wide : icônes avec labels accessibles */}
      <div className="hidden items-center gap-1 sm:flex">
        {canDownload && onDownload ? (
          <button
            type="button"
            disabled={downloadBusy}
            title="Télécharger"
            aria-label={`Télécharger ${itemLabel}`}
            data-testid="imaging-card-download"
            onClick={(e) => {
              stop(e)
              onDownload()
            }}
            className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center gap-1 rounded-lg bg-white/95 px-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-black/5 hover:bg-white hover:text-[#2563EB] disabled:opacity-50"
          >
            <Download className="h-4 w-4" aria-hidden />
            <span className="hidden lg:inline">Télécharger</span>
          </button>
        ) : null}
        {canDelete && onDelete ? (
          <button
            type="button"
            disabled={deleteBusy}
            title="Supprimer"
            aria-label={`Supprimer ${itemLabel}`}
            data-testid="imaging-card-delete"
            onClick={(e) => {
              stop(e)
              onDelete()
            }}
            className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg bg-white/95 px-2 text-gray-500 shadow-sm ring-1 ring-black/5 hover:bg-white hover:text-red-600 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>

      {/* Mobile : overflow ⋯ */}
      <div className="relative sm:hidden">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={`Actions pour ${itemLabel}`}
          data-testid="imaging-card-overflow"
          onClick={(e) => {
            stop(e)
            setOpen((v) => !v)
          }}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-white/95 text-gray-700 shadow-sm ring-1 ring-black/5"
        >
          <MoreVertical className="h-5 w-5" aria-hidden />
        </button>
        {open ? (
          <div
            id={menuId}
            role="menu"
            className="absolute right-0 top-full mt-1 min-w-[11rem] overflow-hidden rounded-xl bg-white py-1 shadow-lg ring-1 ring-black/10"
          >
            {canDownload && onDownload ? (
              <button
                type="button"
                role="menuitem"
                disabled={downloadBusy}
                data-testid="imaging-card-download-mobile"
                onClick={(e) => {
                  stop(e)
                  setOpen(false)
                  onDownload()
                }}
                className="flex w-full min-h-[48px] items-center gap-2 px-4 text-left text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
              >
                <Download className="h-4 w-4" aria-hidden />
                Télécharger
              </button>
            ) : null}
            {canDelete && onDelete ? (
              <button
                type="button"
                role="menuitem"
                disabled={deleteBusy}
                data-testid="imaging-card-delete-mobile"
                onClick={(e) => {
                  stop(e)
                  setOpen(false)
                  onDelete()
                }}
                className="flex w-full min-h-[48px] items-center gap-2 px-4 text-left text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                Supprimer
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
