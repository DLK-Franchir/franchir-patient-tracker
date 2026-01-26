'use client'

import { FileText, Stethoscope, AlertCircle, DollarSign, Calendar } from 'lucide-react'
import { type GlobalStatus } from '@/lib/workflow-v2'

interface TimelineStepProps {
  status: GlobalStatus
  label: string
  isActive: boolean
  isCompleted: boolean
  isRejected?: boolean
  icon: React.ReactNode
}

function TimelineStep({ label, isActive, isCompleted, isRejected, icon }: TimelineStepProps) {
  return (
    <div className="flex flex-col items-center flex-1 relative">
      <div className={`
        w-12 h-12 rounded-full flex items-center justify-center font-semibold text-sm transition-all
        ${isRejected ? 'bg-red-100 text-red-700 border-2 border-red-500' : ''}
        ${isActive && !isRejected ? 'bg-[#2563EB] text-white border-2 border-[#2563EB] shadow-lg' : ''}
        ${isCompleted && !isRejected && !isActive ? 'bg-green-100 text-green-700 border-2 border-green-500' : ''}
        ${!isActive && !isCompleted && !isRejected ? 'bg-gray-100 text-gray-400 border-2 border-gray-300' : ''}
      `}>
        {icon}
      </div>
      <span className={`
        mt-2 text-xs text-center font-medium max-w-[80px]
        ${isActive ? 'text-[#2563EB]' : ''}
        ${isCompleted && !isActive ? 'text-green-700' : ''}
        ${isRejected ? 'text-red-700' : ''}
        ${!isActive && !isCompleted && !isRejected ? 'text-gray-400' : ''}
      `}>
        {label}
      </span>
    </div>
  )
}

interface WorkflowTimelineProps {
  currentStatus: GlobalStatus
}

export default function WorkflowTimeline({ currentStatus }: WorkflowTimelineProps) {
  const steps: { status: GlobalStatus; label: string; icon: React.ReactNode }[] = [
    { status: 'draft', label: 'Brouillon', icon: <FileText className="w-5 h-5" /> },
    { status: 'medical_review', label: 'Revue médicale', icon: <Stethoscope className="w-5 h-5" /> },
    { status: 'medical_more_info', label: 'À compléter', icon: <AlertCircle className="w-5 h-5" /> },
    { status: 'commercial_in_progress', label: 'Commercial', icon: <DollarSign className="w-5 h-5" /> },
    { status: 'scheduled', label: 'Programmé', icon: <Calendar className="w-5 h-5" /> },
  ]

  const statusOrder: GlobalStatus[] = [
    'draft',
    'medical_review',
    'medical_more_info',
    'commercial_in_progress',
    'scheduled',
  ]

  const currentIndex = statusOrder.indexOf(currentStatus)
  const isRejected = currentStatus === 'rejected'

  if (isRejected) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-700 border-2 border-red-500 flex items-center justify-center font-bold text-lg">
            ✕
          </div>
          <div>
            <h3 className="text-lg font-semibold text-red-900">Dossier refusé</h3>
            <p className="text-sm text-red-700">Ce dossier a été refusé. Seul un administrateur peut le réouvrir.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-6">Parcours du dossier</h3>
      <div className="flex items-start justify-between gap-2">
        {steps.map((step, index) => {
          const stepIndex = statusOrder.indexOf(step.status)
          const isActive = step.status === currentStatus
          const isCompleted = stepIndex < currentIndex
          
          return (
            <div key={step.status} className="flex items-center flex-1">
              <TimelineStep
                status={step.status}
                label={step.label}
                isActive={isActive}
                isCompleted={isCompleted}
                icon={step.icon}
              />
              {index < steps.length - 1 && (
                <div className={`
                  h-0.5 flex-1 mx-2 mt-6 transition-all
                  ${isCompleted ? 'bg-green-500' : 'bg-gray-300'}
                `} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
