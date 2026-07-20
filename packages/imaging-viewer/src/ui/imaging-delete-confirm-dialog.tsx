'use client'

import { useEffect, useId, useRef, useState } from 'react'

export type ImagingDeleteConfirmDialogProps = {
  open: boolean
  /** Non-PHI display label (series name or short file name). */
  itemLabel: string
  busy?: boolean
  /**
   * When true, require typing SUPPRIMER before confirm (high-stakes / multi-file).
   * Default false — clear modal confirm is enough for single files.
   */
  requireTypedConfirm?: boolean
  confirmWord?: string
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Confirmation explicite avant suppression — jamais un seul clic sur la poubelle.
 */
export function ImagingDeleteConfirmDialog({
  open,
  itemLabel,
  busy = false,
  requireTypedConfirm = false,
  confirmWord = 'SUPPRIMER',
  onConfirm,
  onCancel,
}: ImagingDeleteConfirmDialogProps) {
  const titleId = useId()
  const descId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [typed, setTyped] = useState('')

  useEffect(() => {
    if (!open) {
      setTyped('')
      return
    }
    const prev = document.activeElement as HTMLElement | null
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [open, busy, onCancel])

  if (!open) return null

  const canConfirm =
    !busy && (!requireTypedConfirm || typed.trim().toUpperCase() === confirmWord.toUpperCase())

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        data-testid="imaging-delete-confirm-dialog"
        className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
      >
        <h2 id={titleId} className="text-base font-semibold text-red-700">
          Supprimer définitivement ?
        </h2>
        <p id={descId} className="mt-2 text-sm text-gray-700">
          « {itemLabel} » sera définitivement supprimé. Cette action est irréversible.
        </p>
        {requireTypedConfirm ? (
          <label className="mt-4 block text-sm text-gray-700">
            Tapez <span className="font-mono font-semibold">{confirmWord}</span> pour confirmer
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={busy}
              autoComplete="off"
              data-testid="imaging-delete-confirm-input"
              className="mt-1.5 w-full min-h-[44px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
            />
          </label>
        ) : null}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            disabled={busy}
            data-testid="imaging-delete-confirm-cancel"
            onClick={onCancel}
            className="min-h-[48px] rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            data-testid="imaging-delete-confirm-submit"
            onClick={onConfirm}
            className="min-h-[48px] rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? 'Suppression…' : 'Supprimer définitivement'}
          </button>
        </div>
      </div>
    </div>
  )
}
