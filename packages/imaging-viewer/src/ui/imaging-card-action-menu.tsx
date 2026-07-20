'use client'

import { useEffect, useId, useRef, useState, type SyntheticEvent } from 'react'
import { Download, Loader2, MoreVertical, Trash2 } from 'lucide-react'

export type ImagingCardActionMenuProps = {
  /** Accessible name of the card item (non-PHI). */
  itemLabel: string
  canDownload?: boolean
  canDelete?: boolean
  downloadBusy?: boolean
  deleteBusy?: boolean
  onDownload?: () => void
  onDelete?: () => void
  /**
   * When delete is product-disabled (e.g. clinicien), show this non-actionable
   * copy in the overflow menu. Never paired with a fake trash control —
   * ignored when `canDelete` is true.
   */
  deleteReservedHint?: string
  /** Optional class on the absolute action host (top-right of card). */
  className?: string
}

/**
 * Actions carte imagerie — desktop : rangée icônes + labels tooltips ;
 * mobile : menu overflow « ⋯ » (cibles 48px, pictogrammes denses).
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
  deleteReservedHint,
  className = '',
}: ImagingCardActionMenuProps) {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)

  const showDeleteReserved = !canDelete && Boolean(deleteReservedHint?.trim())
  /** Mobile always needs ⋯ when download/delete; desktop also when reserved hint. */
  const showOverflow =
    (canDownload && Boolean(onDownload)) ||
    (canDelete && Boolean(onDelete)) ||
    showDeleteReserved

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

  if (!canDownload && !canDelete && !showDeleteReserved) return null

  const stop = (e: SyntheticEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  /** Overflow on mobile always; also on desktop when delete is reserved (hint only). */
  const overflowClass = showDeleteReserved ? 'relative' : 'relative sm:hidden'

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
            title={downloadBusy ? 'Téléchargement…' : 'Télécharger'}
            aria-label={
              downloadBusy ? `Téléchargement de ${itemLabel}` : `Télécharger ${itemLabel}`
            }
            aria-busy={downloadBusy}
            data-testid="imaging-card-download"
            onClick={(e) => {
              stop(e)
              onDownload()
            }}
            className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center gap-1 rounded-lg bg-white/95 px-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-black/5 hover:bg-white hover:text-[#2563EB] disabled:opacity-50"
          >
            {downloadBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Download className="h-4 w-4" aria-hidden />
            )}
            <span className="hidden lg:inline">
              {downloadBusy ? 'Export…' : 'Télécharger'}
            </span>
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

      {/* Mobile overflow ⋯ ; also desktop when delete reserved (hint in menu) */}
      {showOverflow ? (
        <div className={overflowClass}>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={
              downloadBusy ? `Téléchargement pour ${itemLabel}` : `Actions pour ${itemLabel}`
            }
            aria-busy={downloadBusy}
            title={showDeleteReserved ? deleteReservedHint : undefined}
            data-testid="imaging-card-overflow"
            onClick={(e) => {
              stop(e)
              setOpen((v) => !v)
            }}
            className="inline-flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl bg-white/95 text-gray-700 shadow-md ring-1 ring-black/10 sm:min-h-[40px] sm:min-w-[40px] sm:rounded-lg sm:shadow-sm"
          >
            {downloadBusy ? (
              <Loader2 className="h-6 w-6 animate-spin text-[#2563EB] sm:h-5 sm:w-5" aria-hidden />
            ) : (
              <MoreVertical className="h-6 w-6 sm:h-5 sm:w-5" aria-hidden />
            )}
          </button>
          <div
            id={menuId}
            role="menu"
            hidden={!open}
            className="absolute right-0 top-full z-20 mt-1 min-w-[12.5rem] max-w-[16rem] overflow-hidden rounded-xl bg-white py-1 shadow-lg ring-1 ring-black/10"
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
                className="flex w-full min-h-[52px] items-center gap-3 px-4 text-left text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50 sm:hidden"
              >
                {downloadBusy ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                ) : (
                  <Download className="h-5 w-5" aria-hidden />
                )}
                {downloadBusy ? 'Téléchargement…' : 'Télécharger'}
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
                className="flex w-full min-h-[52px] items-center gap-3 px-4 text-left text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-5 w-5" aria-hidden />
                Supprimer
              </button>
            ) : null}
            {showDeleteReserved ? (
              <p
                role="note"
                data-testid="imaging-card-delete-reserved"
                className={[
                  'px-4 py-3 text-xs leading-snug text-gray-500',
                  (canDownload && onDownload) || (canDelete && onDelete)
                    ? 'border-t border-gray-100'
                    : '',
                ].join(' ')}
              >
                {deleteReservedHint}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
