import { canPerformAction, canRolePerformWorkflowAction } from '@/lib/domain/patients/workflow'
import type {
  ActionAuthorizationResult,
  ActionId,
  GlobalStatus,
  PatientRole,
} from '@/lib/domain/patients/types'

export type PatientWorkflowInput = {
  role: PatientRole
  globalStatus: GlobalStatus
  quoteAccepted?: boolean
  dateAccepted?: boolean
}

export function canPerformPatientWorkflowAction(
  input: PatientWorkflowInput,
  actionId: ActionId
): boolean {
  return canRolePerformWorkflowAction({
    role: input.role,
    actionId,
    globalStatus: input.globalStatus,
    quoteAccepted: input.quoteAccepted,
    dateAccepted: input.dateAccepted,
  })
}

export function canPerformPatientWorkflowActionResult(
  input: PatientWorkflowInput,
  actionId: ActionId
): ActionAuthorizationResult {
  return canPerformAction({
    role: input.role,
    actionId,
    globalStatus: input.globalStatus,
    quoteAccepted: input.quoteAccepted,
    dateAccepted: input.dateAccepted,
  })
}
