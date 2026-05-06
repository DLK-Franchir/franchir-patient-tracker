'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { GlobalStatus } from '@/lib/workflow-v2'

interface DraftReminderModalProps {
  patientId: string
  globalStatus: GlobalStatus
  onSubmit: () => void
}

export default function DraftReminderModal({
  patientId,
  globalStatus,
  onSubmit,
}: DraftReminderModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const pendingHrefRef = useRef<string | null>(null)
  const router = useRouter()

  const isDraft = globalStatus === 'draft'

  useEffect(() => {
    if (!isDraft) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDraft])

  useEffect(() => {
    if (!isDraft) return

    const handleClick = (event: MouseEvent) => {
      const target = (event.target as Element)?.closest('a')
      if (!target) return

      const href = target.getAttribute('href')
      if (!href) return

      if (href.includes(`/dashboard/patient/${patientId}`)) return

      if (href.startsWith('/') || href.startsWith('.')) {
        event.preventDefault()
        pendingHrefRef.current = href
        setIsOpen(true)
      }
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [isDraft, patientId])

  const handleConfirmSubmit = async () => {
    setIsSubmitting(true)
    try {
      await onSubmit()
    } finally {
      setIsSubmitting(false)
      setIsOpen(false)
      if (pendingHrefRef.current) {
        router.push(pendingHrefRef.current)
        pendingHrefRef.current = null
      }
    }
  }

  const handleSkip = () => {
    setIsOpen(false)
    if (pendingHrefRef.current) {
      router.push(pendingHrefRef.current)
      pendingHrefRef.current = null
    }
  }

  const handleClose = () => {
    setIsOpen(false)
    pendingHrefRef.current = null
  }

  if (!isDraft || !isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="draft-reminder-title"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
            <span className="text-2xl">📋</span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 id="draft-reminder-title" className="text-lg font-bold text-gray-900">
              Dossier non soumis
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Ce dossier est en brouillon. Voulez-vous le soumettre à la validation médicale avant
              de quitter ?
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Sans soumission, le dossier restera en brouillon et Gilles ne pourra pas l'examiner.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            onClick={handleSkip}
            className="order-3 sm:order-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
          >
            Quitter sans soumettre
          </button>
          <button
            onClick={handleClose}
            className="order-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
          >
            Rester sur le dossier
          </button>
          <button
            onClick={handleConfirmSubmit}
            disabled={isSubmitting}
            className="order-1 sm:order-3 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1d4ed8] transition disabled:opacity-60"
          >
            {isSubmitting ? 'Soumission…' : 'Soumettre à Gilles'}
          </button>
        </div>
      </div>
    </div>
  )
}
