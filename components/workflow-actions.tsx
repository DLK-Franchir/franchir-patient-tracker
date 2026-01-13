'use client'

import { useState } from 'react'
import {
  getAvailableActions,
  type GlobalStatus,
  type UserRole,
  type Action,
  SURGEONS,
} from '@/lib/workflow-v2'

interface WorkflowActionsProps {
  globalStatus: GlobalStatus
  userRole: UserRole
  quoteAccepted?: boolean
  dateAccepted?: boolean
  onAction: (actionId: string, data?: any) => Promise<void>
}

export function WorkflowActions({
  globalStatus,
  userRole,
  quoteAccepted = false,
  dateAccepted = false,
  onAction,
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

  const handleActionClick = (action: Action) => {
    if (action.requiresInput && action.requiresInput.length > 0) {
      setShowModal(action)
      setFormData({})
    } else {
      executeAction(action)
    }
  }

  const executeAction = async (action: Action) => {
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
          <div className="space-y-1">
            {SURGEONS.map((surgeon) => (
              <label key={surgeon} className="flex items-center space-x-2">
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
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-900">{surgeon}</span>
              </label>
            ))}
          </div>
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
            className="w-full border border-gray-300 rounded-lg p-2 text-sm text-gray-900"
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
            className="w-full border border-gray-300 rounded-lg p-2 text-sm text-gray-900"
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
            className="w-full border border-gray-300 rounded-lg p-2 text-sm text-gray-900 text-gray-900"
            placeholder="Ex: 15 mars 2024, 22 mars 2024"
          />
        </div>
      )
    }

    return null
  }

  const buttonVariantClass = (variant: Action['variant']) => {
    switch (variant) {
      case 'primary':
        return 'bg-[#2563EB] hover:bg-[#1d4ed8] text-white shadow-sm'
      case 'secondary':
        return 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300'
      case 'danger':
        return 'bg-red-600 hover:bg-red-700 text-white shadow-sm'
    }
  }

  return (
    <div className="space-y-4">
      {primaryAction && (
        <button
          onClick={() => handleActionClick(primaryAction)}
          disabled={loading}
          className={`w-full py-3 px-4 rounded-lg font-medium transition disabled:opacity-50 ${buttonVariantClass(
            primaryAction.variant
          )}`}
        >
          {primaryAction.label}
        </button>
      )}

      {secondaryActions.length > 0 && (
        <div className="space-y-2">
          {secondaryActions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleActionClick(action)}
              disabled={loading}
              className={`w-full py-2 px-4 rounded-lg font-medium transition disabled:opacity-50 text-sm ${buttonVariantClass(
                action.variant
              )}`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {futureSteps.length > 0 && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Prochaines étapes</div>
          <div className="space-y-2">
            {futureSteps.map((step, idx) => (
              <div key={idx} className="flex items-start space-x-2 text-sm">
                <span className="text-gray-400 font-medium">{idx + 1}.</span>
                <div>
                  <div className="font-medium text-gray-700">{step.label}</div>
                  <div className="text-xs text-gray-500">{step.reason}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{showModal.label}</h3>
            {showModal.description && (
              <p className="text-sm text-gray-600 mb-4">{showModal.description}</p>
            )}
            <div className="space-y-4 mb-6">
              {showModal.requiresInput?.map((input) => renderInput(input))}
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowModal(null)
                  setFormData({})
                }}
                disabled={loading}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50 text-gray-700 font-medium"
              >
                Annuler
              </button>
              <button
                onClick={() => executeAction(showModal)}
                disabled={loading}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition disabled:opacity-50 ${buttonVariantClass(
                  showModal.variant
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
