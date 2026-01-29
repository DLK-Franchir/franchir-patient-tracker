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
        w-8 h-8 sm:w-10 md:w-12 sm:h-10 md:h-12 rounded-full flex items-center justify-center font-semibold text-sm transition-all
        ${isRejected ? 'bg-red-100 text-red-700 border-2 border-red-500' : ''}
        ${isActive && !isRejected ? 'bg-[#2563EB] text-white border-2 border-[#2563EB] shadow-lg' : ''}
        ${isCompleted && !isRejected && !isActive ? 'bg-green-100 text-green-700 border-2 border-green-500' : ''}
        ${!isActive && !isCompleted && !isRejected ? 'bg-gray-100 text-gray-400 border-2 border-gray-300' : ''}
      `}>
        <span className="[&>svg]:w-3.5 [&>svg]:h-3.5 sm:[&>svg]:w-4 sm:[&>svg]:h-4 md:[&>svg]:w-5 md:[&>svg]:h-5">
          {icon}
        </span>
      </div>
      <span className={`
        mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-center font-medium max-w-[50px] sm:max-w-[70px] md:max-w-[80px] leading-tight
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
  const steps: { status: GlobalStatus; label: string; shortLabel: string; icon: React.ReactNode }[] = [
    { status: 'draft', label: 'Brouillon', shortLabel: 'Brouillon', icon: <FileText className="w-5 h-5" /> },
    { status: 'medical_review', label: 'Revue médicale', shortLabel: 'Médical', icon: <Stethoscope className="w-5 h-5" /> },
    { status: 'medical_more_info', label: 'À compléter', shortLabel: 'Compléter', icon: <AlertCircle className="w-5 h-5" /> },
    { status: 'commercial_in_progress', label: 'Commercial', shortLabel: 'Devis', icon: <DollarSign className="w-5 h-5" /> },
    { status: 'scheduled', label: 'Programmé', shortLabel: 'Planifié', icon: <Calendar className="w-5 h-5" /> },
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
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-red-100 text-red-700 border-2 border-red-500 flex items-center justify-center font-bold text-base sm:text-lg shrink-0">
            ✕
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-red-900">Dossier refusé</h3>
            <p className="text-xs sm:text-sm text-red-700">Ce dossier a été refusé. Seul un administrateur peut le réouvrir.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 md:p-6 mb-4 sm:mb-6 shadow-sm">
      <h3 className="text-xs sm:text-sm font-semibold text-gray-700 mb-3 sm:mb-4 md:mb-6">Parcours du dossier</h3>
      <div className="flex items-start justify-between gap-0.5 sm:gap-1 md:gap-2">
        {steps.map((step, index) => {
          const stepIndex = statusOrder.indexOf(step.status)
          const isActive = step.status === currentStatus
          const isCompleted = stepIndex < currentIndex
          
          return (
            <div key={step.status} className="flex items-center flex-1">
              <TimelineStep
                status={step.status}
                label={step.shortLabel}
                isActive={isActive}
                isCompleted={isCompleted}
                icon={step.icon}
              />
              {index < steps.length - 1 && (
                <div className={`
                  h-0.5 flex-1 mx-0.5 sm:mx-1 md:mx-2 mt-4 sm:mt-5 md:mt-6 transition-all
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
