'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Check, Copy, ExternalLink, Link2, Mail } from 'lucide-react'
import {
  buildMailtoHref,
  composeDispatchClipboardText,
  type QuestionnaireEmailDraft,
} from '@/lib/integrations/questionnaire-email-draft'

export type QuestionnaireDispatchPayload = {
  to: string
  questionnaireUrl: string
  draft: QuestionnaireEmailDraft
  expiresAt?: string | null
}

type QuestionnaireDispatchModalProps = {
  open: boolean
  payload: QuestionnaireDispatchPayload | null
  confirming?: boolean
  onConfirmSent: () => void | Promise<void>
  onClose: () => void
}

type CopyTarget = 'all' | 'link' | null

export default function QuestionnaireDispatchModal({
  open,
  payload,
  confirming = false,
  onConfirmSent,
  onClose,
}: QuestionnaireDispatchModalProps) {
  const titleId = useId()
  const descId = useId()
  const primaryBtnRef = useRef<HTMLButtonElement>(null)
  const [copied, setCopied] = useState<CopyTarget>(null)
  const [copyError, setCopyError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    primaryBtnRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirming) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [open, confirming, onClose])

  useEffect(() => {
    if (!open) {
      setCopied(null)
      setCopyError(null)
    }
  }, [open])

  if (!open || !payload) return null

  const fullText = composeDispatchClipboardText({
    to: payload.to,
    subject: payload.draft.subject,
    textBody: payload.draft.textBody,
  })

  const mailtoHref = buildMailtoHref({
    to: payload.to,
    subject: payload.draft.subject,
    textBody: payload.draft.textBody,
  })

  const copyText = async (text: string, target: CopyTarget) => {
    setCopyError(null)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(target)
      window.setTimeout(() => setCopied((current) => (current === target ? null : current)), 2000)
    } catch {
      setCopyError('Impossible de copier automatiquement — sélectionnez le texte ci-dessous.')
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !confirming) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        data-testid="questionnaire-dispatch-modal"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
      >
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 id={titleId} className="text-lg font-bold text-gray-900">
            Préparer l&apos;envoi au patient
          </h2>
          <p id={descId} className="mt-1 text-sm text-gray-600">
            Copiez le message dans Outlook ou Gmail (ou le lien seul pour WhatsApp / SMS), puis
            confirmez une fois l&apos;envoi fait.
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
            <p className="text-gray-500">Destinataire</p>
            <p className="break-all font-medium text-gray-900">{payload.to}</p>
            <p className="mt-2 text-gray-500">Objet</p>
            <p className="font-medium text-gray-900">{payload.draft.subject}</p>
          </div>

          <div>
            <label htmlFor="questionnaire-dispatch-body" className="text-sm font-semibold text-gray-800">
              Message à coller
            </label>
            <textarea
              id="questionnaire-dispatch-body"
              readOnly
              value={payload.draft.textBody}
              rows={12}
              className="mt-2 w-full resize-y rounded-lg border-2 border-gray-300 bg-white p-3 font-mono text-sm text-gray-900 focus:border-[#2563EB] focus:outline-none"
            />
          </div>

          {copyError && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {copyError}
            </p>
          )}
        </div>

        <div className="space-y-2 border-t border-gray-100 px-5 py-4">
          <button
            ref={primaryBtnRef}
            type="button"
            onClick={() => void copyText(fullText, 'all')}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-4 py-3 text-base font-bold text-white hover:bg-[#1d4ed8]"
          >
            {copied === 'all' ? <Check className="h-5 w-5" aria-hidden /> : <Copy className="h-5 w-5" aria-hidden />}
            {copied === 'all' ? 'Copié — collez dans votre boîte mail' : 'Tout copier (objet + message)'}
          </button>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void copyText(payload.questionnaireUrl, 'link')}
              className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              {copied === 'link' ? <Check className="h-4 w-4" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />}
              {copied === 'link' ? 'Lien copié' : 'Copier le lien seul'}
            </button>
            <a
              href={mailtoHref}
              className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              <Mail className="h-4 w-4" aria-hidden />
              Ouvrir mon client mail
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          </div>

          <button
            type="button"
            disabled={confirming}
            onClick={() => void onConfirmSent()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border-2 border-emerald-600 bg-emerald-50 px-4 py-3 text-base font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
          >
            {confirming ? 'Enregistrement…' : "J'ai envoyé le message"}
          </button>

          <button
            type="button"
            disabled={confirming}
            onClick={onClose}
            className="w-full rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            Fermer sans confirmer
          </button>
        </div>
      </div>
    </div>
  )
}
