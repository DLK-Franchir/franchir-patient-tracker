'use client'

import { getGuidance, type GlobalStatus, type UserRole } from '@/lib/workflow-v2'

interface WorkflowGuidanceProps {
  globalStatus: GlobalStatus
  userRole: UserRole
}

export function WorkflowGuidance({ globalStatus, userRole }: WorkflowGuidanceProps) {
  const guidance = getGuidance(globalStatus, userRole)

  const bgColor = {
    draft: 'bg-gray-50 border-gray-200 text-gray-700',
    medical_review: 'bg-blue-50 border-blue-200 text-blue-700',
    medical_more_info: 'bg-orange-50 border-orange-200 text-orange-700',
    rejected: 'bg-red-50 border-red-200 text-red-700',
    commercial_in_progress: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    scheduled: 'bg-green-50 border-green-200 text-green-700',
  }[globalStatus]

  return (
    <div className={`p-4 rounded-lg border ${bgColor} text-sm`}>
      <div className="font-medium mb-1">Prochaine étape</div>
      <div>{guidance}</div>
    </div>
  )
}
