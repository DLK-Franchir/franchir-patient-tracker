'use client'

import { useState } from 'react'
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle,
  Clock,
  Eye,
  FilePlus,
  RotateCcw,
  Send,
  XCircle,
} from 'lucide-react'
import { BRAND } from '@/lib/brand-tokens'
import {
  getAvailableActions,
  isMedicallyValidated,
  type Action,
  type GlobalStatus,
  type UserRole,
} from '@/lib/workflow-v2'
import type { SurgeonOption } from '@/components/workflow-actions'

const ROLE_TITLES: Record<UserRole, string> = {
  marcel: 'Coordinateur',
  franchir: 'Commercial',
  gilles: 'Médecin',
  admin: 'Admin',
}

interface PatientActionPanelProps {
  globalStatus: GlobalStatus
  userRole: UserRole
  patientId: string
  actionTitle: string
  quoteAmount?: number | null
  proposedDate?: string | null
  quoteAccepted?: boolean
  dateAccepted?: boolean
  assignedSurgeonId?: string | null
  surgeons?: SurgeonOption[]
  onAction: (actionId: string, data?: Record<string, unknown>) => Promise<void>
  onCommercialSaved?: () => void
}

const inputClass =
  'w-full rounded-xl px-4 py-3 text-base text-gray-900 outline-none transition-all focus:ring-2 focus:ring-[#1E2B70]/20'

const inputStyle = {
  background: BRAND.cream,
  border: `1px solid ${BRAND.creamMid}`,
}

function PanelButton({
  label,
  onClick,
  variant = 'navy',
  disabled = false,
  disabledReason,
  icon,
  full = true,
}: {
  label: string
  onClick: () => void
  variant?: 'navy' | 'coral' | 'green' | 'red' | 'orange' | 'ghost'
  disabled?: boolean
  disabledReason?: string
  icon?: React.ReactNode
  full?: boolean
}) {
  const variants = {
    navy: { bg: BRAND.navy, color: 'white', hover: BRAND.navyDark },
    coral: { bg: BRAND.coral, color: 'white', hover: BRAND.coralDark },
    green: { bg: BRAND.green, color: 'white', hover: '#0E8040' },
    red: { bg: '#D03030', color: 'white', hover: '#B02020' },
    orange: { bg: '#D97706', color: 'white', hover: '#B45309' },
    ghost: { bg: BRAND.creamDark, color: BRAND.navy, hover: BRAND.creamMid },
  }
  const v = variants[variant]

  return (
    <div className={full ? 'w-full space-y-1' : 'space-y-1'}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={disabled && disabledReason ? disabledReason : undefined}
        className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold text-sm sm:text-base transition-all min-h-[44px] ${
          full ? 'w-full' : ''
        } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
        style={{ background: v.bg, color: v.color }}
        onMouseEnter={(e) => {
          if (!disabled) e.currentTarget.style.background = v.hover
        }}
        onMouseLeave={(e) => {
          if (!disabled) e.currentTarget.style.background = v.bg
        }}
      >
        {icon}
        {label}
      </button>
      {disabled && disabledReason ? (
        <p className="text-xs leading-snug" style={{ color: BRAND.slate }}>
          {disabledReason}
        </p>
      ) : null}
    </div>
  )
}

export function PatientActionPanel({
  globalStatus,
  userRole,
  patientId,
  actionTitle,
  quoteAmount,
  proposedDate,
  quoteAccepted = false,
  dateAccepted = false,
  assignedSurgeonId,
  surgeons = [],
  onAction,
  onCommercialSaved,
}: PatientActionPanelProps) {
  const [loading, setLoading] = useState(false)
  const [budgetVal, setBudgetVal] = useState(quoteAmount?.toString() ?? '')
  const [dateVal, setDateVal] = useState(
    proposedDate ? new Date(proposedDate).toISOString().split('T')[0] : '',
  )
  const [chirVal, setChirVal] = useState(assignedSurgeonId ?? '')
  const [medChirIds, setMedChirIds] = useState<string[]>([])
  const [medComment, setMedComment] = useState('')
  const [refusalText, setRefusalText] = useState('')
  const [moreInfoText, setMoreInfoText] = useState('')
  const [reopenText, setReopenText] = useState('')
  const [franchirBudget, setFranchirBudget] = useState('')
  const [franchirDates, setFranchirDates] = useState('')
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const { primaryAction, secondaryActions } = getAvailableActions({
    globalStatus,
    role: userRole,
    quoteAccepted,
    dateAccepted,
    hasQuoteAmount: Boolean(quoteAmount),
    hasProposedDate: Boolean(proposedDate),
  })

  const findAction = (id: string): Action | undefined => {
    if (primaryAction?.id === id) return primaryAction
    return secondaryActions.find((a) => a.id === id)
  }

  const hasAction = (id: string) => Boolean(findAction(id))

  const runAction = async (actionId: string, data?: Record<string, unknown>) => {
    setLoading(true)
    try {
      await onAction(actionId, data)
      setSuccessMessage('Action enregistrée.')
      window.setTimeout(() => setSuccessMessage(null), 4000)
    } finally {
      setLoading(false)
    }
  }

  const saveCommercialField = async (payload: {
    quoteAmount?: number | null
    proposedDate?: string | null
  }) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/patients/${patientId}/commercial-data`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) throw new Error('Échec de la sauvegarde')
      setSuccessMessage('Données commerciales enregistrées.')
      onCommercialSaved?.()
      window.setTimeout(() => setSuccessMessage(null), 4000)
    } catch {
      alert('Erreur lors de la sauvegarde')
    } finally {
      setLoading(false)
    }
  }

  const renderGillesPanel = () => {
    if (globalStatus !== 'medical_review') {
      return (
        <div className="text-center py-6 space-y-2">
          <Eye size={24} style={{ color: BRAND.slateLight, margin: '0 auto' }} />
          <p className="text-sm" style={{ color: BRAND.slate }}>
            Ce dossier n&apos;est pas en revue médicale.
          </p>
        </div>
      )
    }

    const canValidate = surgeons.length > 0 && medChirIds.length > 0

    return (
      <div className="space-y-4">
        <p className="text-base leading-relaxed" style={{ color: BRAND.ink }}>
          Examinez le dossier et donnez votre avis médical. Recommandez un chirurgien si vous validez.
        </p>
        <div className="space-y-1.5">
          <label className="block text-sm font-semibold" style={{ color: BRAND.ink }}>
            Chirurgien(s) recommandé(s)
          </label>
          {surgeons.length === 0 ? (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
              Aucun chirurgien dans l&apos;annuaire.
            </p>
          ) : (
            <div className="space-y-1 max-h-40 overflow-y-auto rounded-xl p-3" style={inputStyle}>
              {surgeons.map((s) => (
                <label key={s.id} className="flex items-center gap-2 py-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={medChirIds.includes(s.id)}
                    onChange={(e) => {
                      setMedChirIds((prev) =>
                        e.target.checked
                          ? prev.length < 2
                            ? [...prev, s.id]
                            : prev
                          : prev.filter((id) => id !== s.id),
                      )
                    }}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-900">{s.full_name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <textarea
          value={medComment}
          onChange={(e) => setMedComment(e.target.value)}
          placeholder="Commentaire médical (optionnel)"
          rows={2}
          className={inputClass}
          style={{ ...inputStyle, resize: 'none' }}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <PanelButton
            label="Valider"
            variant="green"
            disabled={loading || !canValidate}
            disabledReason={
              !canValidate
                ? surgeons.length === 0
                  ? 'Ajoutez un chirurgien dans l’annuaire'
                  : 'Sélectionnez au moins un chirurgien'
                : undefined
            }
            icon={<CheckCircle size={15} />}
            onClick={() =>
              runAction('approve_medical', { surgeonIds: medChirIds, message: medComment || undefined })
            }
          />
          <PanelButton
            label="Refuser"
            variant="red"
            disabled={loading}
            icon={<XCircle size={15} />}
            onClick={() => {
              if (!refusalText.trim()) {
                alert('Veuillez saisir une justification.')
                return
              }
              runAction('reject_medical', { justification: refusalText })
            }}
          />
        </div>
        <div className="pt-4 border-t space-y-2" style={{ borderColor: BRAND.cream }}>
          <label className="block text-sm font-semibold" style={{ color: BRAND.ink }}>
            Demander un complément
          </label>
          <textarea
            value={moreInfoText}
            onChange={(e) => setMoreInfoText(e.target.value)}
            placeholder="Précisez les éléments manquants…"
            rows={2}
            className={inputClass}
            style={{ ...inputStyle, resize: 'none' }}
          />
          <PanelButton
            label="Envoyer la demande"
            variant="ghost"
            disabled={loading || !moreInfoText.trim()}
            disabledReason={!moreInfoText.trim() ? 'Précisez les éléments manquants' : undefined}
            icon={<Send size={14} />}
            onClick={() => runAction('request_more_info', { message: moreInfoText })}
          />
        </div>
        <textarea
          value={refusalText}
          onChange={(e) => setRefusalText(e.target.value)}
          placeholder="Justification du refus (requis pour refuser)"
          rows={2}
          className={inputClass}
          style={{ ...inputStyle, resize: 'none' }}
        />
      </div>
    )
  }

  const renderReopenPanel = (intro: string) => (
    <div className="space-y-3">
      <p className="text-base leading-relaxed" style={{ color: BRAND.ink }}>
        {intro}
      </p>
      <textarea
        value={reopenText}
        onChange={(e) => setReopenText(e.target.value)}
        placeholder="Raison de la réouverture"
        rows={2}
        className={inputClass}
        style={{ ...inputStyle, resize: 'none' }}
      />
      <PanelButton
        label="Réouvrir le dossier"
        variant="orange"
        disabled={loading || !reopenText.trim()}
        disabledReason={!reopenText.trim() ? 'Indiquez la raison de la réouverture' : undefined}
        icon={<RotateCcw size={15} />}
        onClick={() => runAction('reopen_case', { message: reopenText })}
      />
    </div>
  )

  /** Refus toujours visible + actionnable (motif requis au clic). Terminal → Réouvrir. */
  const renderRefuseSecondary = () => {
    if (globalStatus === 'rejected' || globalStatus === 'closed') return null
    if (!hasAction('reject_medical')) return null
    // Revue médicale admin/Gilles : le bouton Refuser est déjà dans le panneau médical.
    if (
      globalStatus === 'medical_review' &&
      (userRole === 'gilles' || userRole === 'admin')
    ) {
      return null
    }
    return (
      <div className="pt-3 border-t space-y-2" style={{ borderColor: BRAND.cream }}>
        <label className="block text-sm font-semibold" style={{ color: BRAND.ink }}>
          Passer en mode refusé
        </label>
        <p className="text-xs" style={{ color: BRAND.slate }}>
          Le dossier reste visible dans la liste (onglet Refusé) et pourra être réouvert.
        </p>
        <textarea
          value={refusalText}
          onChange={(e) => setRefusalText(e.target.value)}
          placeholder="Motif du refus (requis)"
          rows={2}
          className={inputClass}
          style={{ ...inputStyle, resize: 'none' }}
        />
        <PanelButton
          label="Passer en mode refusé"
          variant="red"
          disabled={loading}
          icon={<XCircle size={15} />}
          onClick={() => {
            if (!refusalText.trim()) {
              alert('Veuillez saisir un motif de refus.')
              return
            }
            runAction('reject_medical', { justification: refusalText })
          }}
        />
      </div>
    )
  }

  const renderCloseSecondary = () => {
    if (!hasAction('close_case')) return null
    return (
      <div className="pt-3 border-t space-y-2" style={{ borderColor: BRAND.cream }}>
        <PanelButton
          label="Fermer le dossier"
          variant="ghost"
          disabled={loading}
          icon={<XCircle size={14} />}
          onClick={() => {
            const motif = window.prompt('Motif de clôture (optionnel) :')
            if (motif === null) return
            runAction('close_case', { message: motif.trim() || undefined })
          }}
        />
      </div>
    )
  }

  const renderAssignSurgeonControl = () => {
    const assign = findAction('assign_surgeon')
    if (!assign) return null

    const isReassign = Boolean(assignedSurgeonId)
    const currentSurgeon = surgeons.find((s) => s.id === assignedSurgeonId)
    const workflowBlocked = Boolean(assign.disabled)
    const needsSelection = !chirVal
    const sameAsCurrent = Boolean(assignedSurgeonId && chirVal === assignedSurgeonId)
    const disabled = loading || workflowBlocked || needsSelection || sameAsCurrent
    const disabledReason = workflowBlocked
      ? assign.disabledReason
      : needsSelection
        ? 'Sélectionnez un chirurgien'
        : sameAsCurrent
          ? 'Ce chirurgien est déjà assigné'
          : undefined

    return (
      <div className="space-y-1.5">
        <label className="block text-sm font-semibold" style={{ color: BRAND.ink }}>
          {isReassign ? 'Modifier le chirurgien' : 'Assigner un chirurgien'}
        </label>
        {isReassign && currentSurgeon ? (
          <p className="text-xs leading-snug" style={{ color: BRAND.slate }}>
            Actuellement : {currentSurgeon.full_name}
          </p>
        ) : null}
        <select
          value={chirVal}
          onChange={(e) => setChirVal(e.target.value)}
          disabled={workflowBlocked || loading}
          className={inputClass}
          style={inputStyle}
        >
          <option value="">— Sélectionner —</option>
          {surgeons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name}
            </option>
          ))}
        </select>
        <PanelButton
          label={isReassign ? 'Modifier le chirurgien' : 'Assigner le chirurgien'}
          variant="navy"
          disabled={disabled}
          disabledReason={disabledReason}
          onClick={() => runAction('assign_surgeon', { surgeonId: chirVal })}
        />
      </div>
    )
  }

  const renderConfirmQuote = () => {
    const action = findAction('confirm_quote')
    if (!action || quoteAccepted) return null

    const ready = Boolean(quoteAmount)
    const disabled = loading || action.disabled || !ready
    const disabledReason =
      action.disabledReason || (!ready ? 'Enregistrez d’abord le devis' : undefined)

    if (ready) {
      return (
        <div
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-xl p-3.5 gap-3"
          style={{ background: '#EBF0FA', border: `1px solid ${BRAND.navy}30` }}
        >
          <div>
            <div className="text-sm font-bold" style={{ color: BRAND.navy }}>
              Devis : {quoteAmount!.toLocaleString('fr-FR')} €
            </div>
            <div className="text-xs" style={{ color: BRAND.slate }}>
              Le patient a-t-il confirmé ?
            </div>
          </div>
          <PanelButton
            label="Confirmer"
            variant="green"
            full={false}
            disabled={disabled}
            disabledReason={disabledReason}
            icon={<CheckCircle size={13} />}
            onClick={() => runAction('confirm_quote')}
          />
        </div>
      )
    }

    return (
      <PanelButton
        label="Confirmer le devis"
        variant="green"
        disabled={disabled}
        disabledReason={disabledReason}
        icon={<CheckCircle size={15} />}
        onClick={() => runAction('confirm_quote')}
      />
    )
  }

  const renderConfirmDate = () => {
    const action = findAction('confirm_date')
    if (!action || dateAccepted) return null

    const ready = Boolean(proposedDate)
    const disabled = loading || action.disabled || !ready
    const disabledReason =
      action.disabledReason || (!ready ? 'Enregistrez d’abord la date' : undefined)

    if (ready) {
      return (
        <div
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-xl p-3.5 gap-3"
          style={{ background: '#EBF0FA', border: `1px solid ${BRAND.navy}30` }}
        >
          <div>
            <div className="text-sm font-bold" style={{ color: BRAND.navy }}>
              Date :{' '}
              {new Date(proposedDate!).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </div>
            <div className="text-xs" style={{ color: BRAND.slate }}>
              Date confirmée par le patient ?
            </div>
          </div>
          <PanelButton
            label="Confirmer"
            variant="green"
            full={false}
            disabled={disabled}
            disabledReason={disabledReason}
            icon={<Check size={13} />}
            onClick={() => runAction('confirm_date')}
          />
        </div>
      )
    }

    return (
      <PanelButton
        label="Confirmer la date"
        variant="green"
        disabled={disabled}
        disabledReason={disabledReason}
        icon={<Check size={15} />}
        onClick={() => runAction('confirm_date')}
      />
    )
  }

  const renderCommercialFields = () => {
    const canEditCommercial =
      userRole === 'marcel' || userRole === 'franchir' || userRole === 'admin'
    if (!canEditCommercial || globalStatus !== 'commercial_in_progress') return null

    const showBudgetInput = !quoteAmount
    const showDateInput = !proposedDate
    const canSaveCommercial =
      (userRole === 'marcel' || userRole === 'admin') && (showBudgetInput || showDateInput)
    const saveDisabled = loading || (!budgetVal.trim() && !dateVal)

    return (
      <div className="space-y-4">
        {userRole === 'franchir' && (
          <>
            {hasAction('add_budget') && (
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold" style={{ color: BRAND.ink }}>
                  Budget indicatif
                </label>
                <input
                  type="text"
                  value={franchirBudget}
                  onChange={(e) => setFranchirBudget(e.target.value)}
                  placeholder="Ex: 5000 € TTC"
                  className={inputClass}
                  style={inputStyle}
                />
                <PanelButton
                  label="Enregistrer le budget"
                  variant="navy"
                  disabled={loading || !franchirBudget.trim()}
                  disabledReason={!franchirBudget.trim() ? 'Saisissez un budget' : undefined}
                  onClick={() => runAction('add_budget', { budget: franchirBudget })}
                />
              </div>
            )}
            {hasAction('propose_dates') && (
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold" style={{ color: BRAND.ink }}>
                  Dates proposées
                </label>
                <textarea
                  value={franchirDates}
                  onChange={(e) => setFranchirDates(e.target.value)}
                  placeholder="Ex: 15 mars 2026, 22 mars 2026"
                  rows={2}
                  className={inputClass}
                  style={{ ...inputStyle, resize: 'none' }}
                />
                <PanelButton
                  label="Proposer les dates"
                  variant="navy"
                  disabled={loading || !franchirDates.trim()}
                  disabledReason={!franchirDates.trim() ? 'Saisissez au moins une date' : undefined}
                  onClick={() => runAction('propose_dates', { dates: franchirDates })}
                />
              </div>
            )}
          </>
        )}

        {(userRole === 'marcel' || userRole === 'admin') && showBudgetInput && (
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold" style={{ color: BRAND.ink }}>
              Budget indicatif (€)
            </label>
            <input
              type="number"
              value={budgetVal}
              onChange={(e) => setBudgetVal(e.target.value)}
              placeholder="ex. 4500"
              className={inputClass}
              style={inputStyle}
            />
          </div>
        )}

        {(userRole === 'marcel' || userRole === 'admin') && showDateInput && (
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold" style={{ color: BRAND.ink }}>
              Date d&apos;intervention proposée
            </label>
            <input
              type="date"
              value={dateVal}
              onChange={(e) => setDateVal(e.target.value)}
              className={inputClass}
              style={inputStyle}
            />
          </div>
        )}

        {canSaveCommercial && (
          <PanelButton
            label="Enregistrer devis / date"
            variant="navy"
            disabled={saveDisabled}
            disabledReason={
              saveDisabled && !loading ? 'Saisissez un devis ou une date' : undefined
            }
            icon={<Check size={15} />}
            onClick={() =>
              saveCommercialField({
                quoteAmount: budgetVal ? parseFloat(budgetVal) : null,
                proposedDate: dateVal ? new Date(dateVal).toISOString() : null,
              })
            }
          />
        )}

        {isMedicallyValidated(globalStatus) && renderAssignSurgeonControl()}
        {renderConfirmQuote()}
        {renderConfirmDate()}
      </div>
    )
  }

  const renderCoordinatorPanel = () => {
    if (globalStatus === 'draft' && hasAction('submit_to_medical')) {
      return (
        <div className="space-y-3">
          <p className="text-base leading-relaxed" style={{ color: BRAND.ink }}>
            Le dossier est prêt à être soumis au Dr Dubois pour validation médicale.
          </p>
          <PanelButton
            label="Soumettre au Dr Dubois"
            variant="coral"
            disabled={loading}
            icon={<Send size={15} />}
            onClick={() => runAction('submit_to_medical')}
          />
          {renderAssignSurgeonControl()}
          {renderRefuseSecondary()}
          {renderCloseSecondary()}
        </div>
      )
    }

    if (globalStatus === 'medical_more_info' && hasAction('resubmit_to_medical')) {
      return (
        <div className="space-y-3">
          <div
            className="flex items-start gap-2.5 rounded-xl p-3.5"
            style={{ background: '#FDF3E8', border: '1px solid #F4C896' }}
          >
            <AlertTriangle size={15} color={BRAND.coral} className="shrink-0 mt-0.5" />
            <p className="text-sm text-[#7A3A10]">Complétez le dossier puis renvoyez-le en revue médicale.</p>
          </div>
          <PanelButton
            label="Renvoyer au Dr Dubois"
            variant="orange"
            disabled={loading}
            icon={<FilePlus size={15} />}
            onClick={() => runAction('resubmit_to_medical')}
          />
          {renderAssignSurgeonControl()}
          {renderRefuseSecondary()}
          {renderCloseSecondary()}
        </div>
      )
    }

    if (globalStatus === 'medical_review') {
      return (
        <div className="space-y-3">
          <div
            className="flex items-start gap-2.5 rounded-xl p-3.5"
            style={{ background: '#EBF0FA', border: `1px solid ${BRAND.navy}30` }}
          >
            <Clock size={15} color={BRAND.navy} className="shrink-0 mt-0.5" />
            <p className="text-sm" style={{ color: BRAND.navy }}>
              En attente de la décision du Dr Dubois. Vous serez notifié dès que la validation est rendue.
            </p>
          </div>
          <PanelButton
            label="Envoyer un rappel"
            variant="ghost"
            disabled={loading}
            icon={<Bell size={14} />}
            onClick={() => alert('Rappel — fonctionnalité à venir')}
          />
          {renderAssignSurgeonControl()}
          {renderRefuseSecondary()}
          {renderCloseSecondary()}
        </div>
      )
    }

    if (globalStatus === 'commercial_in_progress') {
      const needsQuoteOrDate = !quoteAmount || !proposedDate
      return (
        <div className="space-y-3">
          {needsQuoteOrDate && (
            <p className="text-base leading-relaxed" style={{ color: BRAND.ink }}>
              Dossier validé médicalement. Saisissez le devis et/ou la date d&apos;intervention,
              puis enregistrez. Vous pouvez aussi modifier le chirurgien ci-dessous.
            </p>
          )}
          {renderCommercialFields()}
          {renderRefuseSecondary()}
          {renderCloseSecondary()}
        </div>
      )
    }

    if (globalStatus === 'scheduled') {
      return (
        <div className="space-y-3">
          {!dateAccepted && hasAction('confirm_date') ? (
            <>
              <p className="text-base leading-relaxed" style={{ color: BRAND.ink }}>
                L&apos;intervention est planifiée. Confirmez la date définitive avec le patient.
              </p>
              {renderConfirmDate()}
            </>
          ) : (
            <div className="text-center py-4 space-y-2">
              <CheckCircle size={36} color={BRAND.green} style={{ margin: '0 auto' }} />
              <p className="text-base font-extrabold text-[#0A4A28]">Intervention confirmée</p>
            </div>
          )}
          {renderAssignSurgeonControl()}
          {renderRefuseSecondary()}
          {renderCloseSecondary()}
        </div>
      )
    }

    if ((globalStatus === 'rejected' || globalStatus === 'closed') && hasAction('reopen_case')) {
      return renderReopenPanel(
        globalStatus === 'rejected'
          ? 'Dossier refusé. Réouvrez pour le remettre en circuit.'
          : 'Dossier fermé. Réouvrez pour reprendre le suivi.',
      )
    }

    if (globalStatus === 'rejected' || globalStatus === 'closed') {
      return (
        <div className="text-center py-5 space-y-2">
          <XCircle size={28} color="#D04040" style={{ margin: '0 auto' }} />
          <p className="text-sm font-bold text-[#5A1010]">
            {globalStatus === 'rejected' ? 'Dossier refusé' : 'Dossier fermé'}
          </p>
          <p className="text-xs" style={{ color: BRAND.slate }}>
            Aucune action de réouverture pour votre rôle.
          </p>
        </div>
      )
    }

    // Filet de sécurité : jamais de panneau vide — surface refus / fermeture.
    return (
      <div className="space-y-3">
        <p className="text-sm" style={{ color: BRAND.slate }}>
          Actions disponibles pour ce dossier.
        </p>
        {renderAssignSurgeonControl()}
        {renderRefuseSecondary()}
        {renderCloseSecondary()}
      </div>
    )
  }

  const renderAdminPanel = () => (
    <div className="space-y-3">
      {(globalStatus === 'rejected' || globalStatus === 'closed') && hasAction('reopen_case') &&
        renderReopenPanel(
          globalStatus === 'rejected'
            ? 'Dossier refusé. Réouvrez pour le remettre en circuit.'
            : 'Dossier fermé. Réouvrez pour reprendre le suivi.',
        )}
      {globalStatus !== 'rejected' && globalStatus !== 'closed' && (
        <p className="text-sm" style={{ color: BRAND.slate }}>
          Supervision — utilisez les actions ci-dessous selon le statut du dossier.
        </p>
      )}
      {primaryAction &&
        primaryAction.id !== 'reopen_case' &&
        primaryAction.id !== 'confirm_quote' &&
        primaryAction.id !== 'confirm_date' &&
        primaryAction.id !== 'reject_medical' && (
          <PanelButton
            label={primaryAction.label}
            variant="navy"
            disabled={loading || Boolean(primaryAction.disabled)}
            disabledReason={primaryAction.disabledReason}
            onClick={() => {
              if (primaryAction.disabled) return
              runAction(primaryAction.id)
            }}
          />
        )}
      {renderAssignSurgeonControl()}
      {renderConfirmQuote()}
      {renderConfirmDate()}
      {renderRefuseSecondary()}
      {renderCloseSecondary()}
    </div>
  )

  const renderBody = () => {
    if (userRole === 'gilles') return renderGillesPanel()
    if (userRole === 'admin') {
      if (globalStatus === 'medical_review') return renderGillesPanel()
      if (globalStatus === 'commercial_in_progress') {
        return (
          <div className="space-y-3">
            {renderCommercialFields()}
            {renderRefuseSecondary()}
            {renderCloseSecondary()}
          </div>
        )
      }
      if (['draft', 'medical_more_info', 'scheduled'].includes(globalStatus)) {
        const coord = renderCoordinatorPanel()
        if (coord) return coord
      }
      return renderAdminPanel()
    }
    if (userRole === 'franchir') {
      if (globalStatus === 'commercial_in_progress') {
        return (
          <div className="space-y-3">
            {renderCommercialFields()}
            {renderCloseSecondary()}
          </div>
        )
      }
      if ((globalStatus === 'rejected' || globalStatus === 'closed') && hasAction('reopen_case')) {
        return renderReopenPanel(
          globalStatus === 'rejected'
            ? 'Dossier refusé. Réouvrez pour le remettre en circuit.'
            : 'Dossier fermé. Réouvrez pour reprendre le suivi.',
        )
      }
      return (
        <div className="space-y-3">
          <p className="text-sm" style={{ color: BRAND.slate }}>
            Aucune action commerciale requise à cette étape.
          </p>
          {renderAssignSurgeonControl()}
          {renderCloseSecondary()}
        </div>
      )
    }
    return renderCoordinatorPanel()
  }

  return (
    <div
      className="rounded-2xl shadow-sm overflow-hidden"
      style={{ border: `1px solid ${BRAND.creamMid}` }}
    >
      <div style={{ background: BRAND.navy, padding: '18px 20px' }}>
        <div
          className="text-[11px] font-extrabold uppercase tracking-widest mb-1.5"
          style={{ color: 'rgba(255,255,255,0.55)' }}
        >
          {ROLE_TITLES[userRole]}
        </div>
        <div
          className="text-lg sm:text-xl font-black text-white leading-tight"
          style={{ fontFamily: 'var(--font-nunito, Nunito, sans-serif)' }}
        >
          {actionTitle}
        </div>
      </div>
      <div className="bg-white p-5 space-y-4">
        {successMessage && (
          <div
            role="status"
            className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-900"
          >
            {successMessage}
          </div>
        )}
        {renderBody()}
      </div>
    </div>
  )
}
