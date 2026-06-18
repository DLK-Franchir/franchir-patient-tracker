'use client'

import { useState } from 'react'
import {
  getAvailableActions,
  getWorkflowHandoff,
  isWaitingOnOther,
  type GlobalStatus,
  type UserRole,
  type Action,
  SURGEONS,
} from '@/lib/workflow-v2'
import { GuidanceBanner } from '@/components/ui/guidance-banner'
import { Clock } from 'lucide-react'

export interface SurgeonOption {
  id: string
  full_name: string
}

interface WorkflowActionsProps {
  globalStatus: GlobalStatus
  userRole: UserRole
  quoteAccepted?: boolean
  dateAccepted?: boolean
  /** Annuaire chirurgiens (id annuaire) pour l'assignation réelle — D6. */
  surgeons?: SurgeonOption[]
  onAction: (actionId: string, data?: any) => Promise<void>
  /** Intégrer le bandeau de guidance (défaut: true). */
  showGuidance?: boolean
}

export function WorkflowActions({
  globalStatus,
  userRole,
  quoteAccepted = false,
  dateAccepted = false,
  surgeons = [],
  onAction,
  showGuidance = true,
}: WorkflowActionsProps) {
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState<Action | null>(null)
  const [formData, setFormData] = useState<Record<string, any>>({})

  const { primaryAction, secondaryActions, futureSteps } = getAvailableActions({
    globalStatus,
    role: userRole,
    quoteAccepted,
    dateAccepted,
  })

  const handoff = getWorkflowHandoff(globalStatus, userRole)
  const enabledSecondary = secondaryActions.filter((a) => !a.disabled)
  const disabledSecondary = secondaryActions.filter((a) => a.disabled)
  const hasActions = Boolean(primaryAction) || enabledSecondary.length > 0
  const waitingOnOther = !hasActions && isWaitingOnOther(handoff, userRole)

  const handleActionClick = (action: Action) => {
    if (action.disabled) return
    if (action.requiresInput && action.requiresInput.length > 0) {
      setShowModal(action)
      setFormData({})
    } else {
      executeAction(action)
    }
  }

  const executeAction = async (action: Action) => {
    if (action.disabled) return
    setLoading(true)
    try {
      await onAction(action.id, formData)
      setShowModal(null)
      setFormData({})
    } catch (error) {
      console.error('Action failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const renderInput = (input: NonNullable<Action['requiresInput']>[0]) => {
    if (input.type === 'surgeons') {
      return (
        <div key={input.type} className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {input.label} {input.required && <span className="text-red-500">*</span>}
          </label>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {SURGEONS.map((surgeon) => (
              <label key={surgeon} className="flex items-center space-x-2 py-1">
                <input
                  type="checkbox"
                  checked={formData.surgeons?.includes(surgeon) || false}
                  onChange={(e) => {
                    const current = formData.surgeons || []
                    const updated = e.target.checked
                      ? [...current, surgeon]
                      : current.filter((s: string) => s !== surgeon)
                    setFormData({ ...formData, surgeons: updated })
                  }}
                  className="rounded border-gray-300 w-5 h-5"
                />
                <span className="text-sm text-gray-900">{surgeon}</span>
              </label>
            ))}
          </div>
        </div>
      )
    }

    if (input.type === 'surgeon_select') {
      return (
        <div key={input.type} className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {input.label} {input.required && <span className="text-red-500">*</span>}
          </label>
          {surgeons.length === 0 ? (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              Aucun chirurgien dans l&apos;annuaire. Ajoutez des chirurgiens (avec leur email)
              pour permettre l&apos;assignation et la visibilité côté questionnaires.
            </p>
          ) : (
            <select
              value={formData.surgeonId || ''}
              onChange={(e) => setFormData({ ...formData, surgeonId: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-3 text-base text-gray-900 bg-white"
            >
              <option value="">— Sélectionner un chirurgien —</option>
              {surgeons.map((surgeon) => (
                <option key={surgeon.id} value={surgeon.id}>
                  {surgeon.full_name}
                </option>
              ))}
            </select>
          )}
        </div>
      )
    }

    if (input.type === 'message' || input.type === 'justification') {
      return (
        <div key={input.type} className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {input.label} {input.required && <span className="text-red-500">*</span>}
          </label>
          <textarea
            value={formData[input.type] || ''}
            onChange={(e) => setFormData({ ...formData, [input.type]: e.target.value })}
            rows={4}
            className="w-full border border-gray-300 rounded-lg p-3 text-base text-gray-900"
            placeholder={`Saisissez ${input.label.toLowerCase()}...`}
          />
        </div>
      )
    }

    if (input.type === 'budget') {
      return (
        <div key={input.type} className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {input.label} {input.required && <span className="text-red-500">*</span>}
          </label>
          <input
            type="text"
            value={formData.budget || ''}
            onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
            className="w-full border border-gray-300 rounded-lg p-3 text-base text-gray-900"
            placeholder="Ex: 5000-7000€ TTC"
          />
        </div>
      )
    }

    if (input.type === 'dates') {
      return (
        <div key={input.type} className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {input.label} {input.required && <span className="text-red-500">*</span>}
          </label>
          <textarea
            value={formData.dates || ''}
            onChange={(e) => setFormData({ ...formData, dates: e.target.value })}
            rows={3}
            className="w-full border border-gray-300 rounded-lg p-3 text-base text-gray-900"
            placeholder="Ex: 15 mars 2024, 22 mars 2024"
          />
        </div>
      )
    }

    return null
  }

  const actionButtonClass = (action: Action, isDisabled = false) => {
    if (isDisabled) {
      if (action.id === 'assign_surgeon') {
        return 'bg-green-900/25 text-green-900/50 border border-green-800/20 cursor-not-allowed'
      }
      return 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
    }

    switch (action.id) {
      case 'reject_medical':
        return 'bg-red-600 hover:bg-red-700 text-white shadow-sm'
      case 'approve_medical':
        return 'bg-teal-600 hover:bg-teal-700 text-white shadow-sm'
      case 'request_more_info':
        return 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300'
      case 'assign_surgeon':
        return 'bg-green-800 hover:bg-green-900 text-white shadow-sm'
      case 'confirm_quote':
        return 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
      case 'confirm_date':
        return 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
      case 'submit_to_medical':
      case 'resubmit_to_medical':
        return 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
      case 'reopen_case':
        return 'bg-violet-600 hover:bg-violet-700 text-white shadow-sm'
      case 'add_budget':
        return 'bg-orange-50 hover:bg-orange-100 text-orange-900 border border-orange-300'
      case 'propose_dates':
        return 'bg-violet-50 hover:bg-violet-100 text-violet-900 border border-violet-300'
      default:
        switch (action.variant) {
          case 'danger':
            return 'bg-red-600 hover:bg-red-700 text-white shadow-sm'
          case 'secondary':
            return 'bg-gray-50 hover:bg-gray-100 text-gray-800 border border-gray-300'
          default:
            return 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
        }
    }
  }

  const renderActionButton = (action: Action) => {
    const isDisabled = Boolean(action.disabled)
    return (
      <div key={action.id} className="space-y-1">
        <button
          type="button"
          onClick={() => handleActionClick(action)}
          disabled={loading || isDisabled}
          title={action.disabledReason}
          aria-disabled={isDisabled}
          className={`w-full py-2.5 sm:py-3 px-4 rounded-lg font-semibold transition text-sm sm:text-base min-h-[44px] ${actionButtonClass(
            action,
            isDisabled,
          )} ${isDisabled ? 'opacity-60' : ''}`}
        >
          {action.label}
        </button>
        {isDisabled && action.disabledReason && (
          <p className="text-xs text-gray-500 text-center px-2">{action.disabledReason}</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      {showGuidance && (
        <GuidanceBanner
          globalStatus={globalStatus}
          guidance={handoff.guidance}
          waitingOnOther={waitingOnOther}
          pendingActorLabel={handoff.pendingActorLabel}
          waitingDetail={handoff.waitingDetail}
        />
      )}

      {waitingOnOther && (
        <div className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 px-4 py-4 text-base text-amber-900">
          <div className="flex items-center gap-2 font-bold">
            <Clock className="w-5 h-5 shrink-0" aria-hidden />
            Aucune action de votre part pour le moment
          </div>
          <p className="mt-2 text-sm leading-relaxed">{handoff.waitingDetail}</p>
        </div>
      )}

      {primaryAction && renderActionButton(primaryAction)}

      {enabledSecondary.length > 0 && (
        <div className="space-y-2">{enabledSecondary.map(renderActionButton)}</div>
      )}

      {disabledSecondary.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Prochainement
          </p>
          {disabledSecondary.map(renderActionButton)}
        </div>
      )}

      {futureSteps.length > 0 && (
        <div className="mt-2 p-4 bg-slate-50 rounded-xl border-2 border-slate-200">
          <div className="text-sm font-bold text-slate-600 uppercase mb-3">Étapes suivantes</div>
          <div className="space-y-3">
            {futureSteps.map((step, idx) => (
              <div key={idx} className="flex items-start space-x-3 text-base">
                <span className="text-slate-400 font-bold">{idx + 1}.</span>
                <div>
                  <div className="font-semibold text-slate-800">{step.label}</div>
                  <div className="text-sm text-slate-500">{step.reason}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-lg shadow-xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 sm:p-6 sm:border-b-0">
              <h3 className="text-lg font-semibold text-gray-900">{showModal.label}</h3>
              {showModal.description && (
                <p className="text-sm text-gray-600 mt-1">{showModal.description}</p>
              )}
            </div>
            <div className="p-4 sm:p-6 sm:pt-0 space-y-4">
              {showModal.requiresInput?.map((input) => renderInput(input))}
            </div>
            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 sm:p-6 flex flex-col-reverse sm:flex-row gap-3 sm:gap-3">
              <button
                onClick={() => {
                  setShowModal(null)
                  setFormData({})
                }}
                disabled={loading}
                className="w-full sm:flex-1 py-3 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50 text-gray-700 font-medium min-h-[48px]"
              >
                Annuler
              </button>
              <button
                onClick={() => executeAction(showModal)}
                disabled={loading}
                className={`w-full sm:flex-1 py-3 px-4 rounded-lg font-medium transition disabled:opacity-50 min-h-[48px] ${actionButtonClass(
                  showModal
                )}`}
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
