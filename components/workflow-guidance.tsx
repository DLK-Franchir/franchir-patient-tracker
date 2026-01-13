'use client'

import { getGuidance, type GlobalStatus, type UserRole } from '@/lib/workflow-v2'
import { Info } from 'lucide-react'

interface WorkflowGuidanceProps {
  globalStatus: GlobalStatus
  userRole: UserRole
}

export function WorkflowGuidance({ globalStatus, userRole }: WorkflowGuidanceProps) {
  const guidance = getGuidance(globalStatus, userRole)

  const bgColor = {
    draft: 'bg-gray-50 border-gray-200 text-gray-700',
    medical_review: 'bg-blue-50 border-blue-200 text-blue-800',
    medical_more_info: 'bg-orange-50 border-orange-200 text-orange-800',
    rejected: 'bg-red-50 border-red-200 text-red-800',
    commercial_in_progress: 'bg-[#EFF6FF] border-[#2563EB] text-[#1e40af]',
    scheduled: 'bg-green-50 border-green-200 text-green-800',
  }[globalStatus]

  return (
    <div className={`p-4 rounded-lg border ${bgColor} text-sm`}>
      <div className="flex items-center gap-2 font-semibold mb-2">
        <Info className="w-4 h-4" />
        Prochaine étape
      </div>
      <div className="leading-relaxed">{guidance}</div>
    </div>
  )
}
