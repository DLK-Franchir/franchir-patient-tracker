import type { Role } from '@/lib/constants'

export type PatientRole = Role

export type GlobalStatus =
  | 'draft'
  | 'medical_review'
  | 'medical_more_info'
  | 'rejected'
  | 'commercial_in_progress'
  | 'scheduled'

export type ActionId =
  | 'submit_to_medical'
  | 'resubmit_to_medical'
  | 'approve_medical'
  | 'request_more_info'
  | 'reject_medical'
  | 'confirm_quote'
  | 'confirm_date'
  | 'reopen_case'
  | 'add_budget'
  | 'propose_dates'

export type PermissionActionId =
  | ActionId
  | 'create_patient'
  | 'edit_patient_summary'
  | 'edit_commercial_data'
  | 'post_message'

export type LockedPatientField =
  | 'workflow_actions'
  | 'patient_summary'
  | 'commercial_data'
  | 'messages'

export type ActionAuthorizationResult = {
  allowed: boolean
  reason?: string
  fieldsLocked?: LockedPatientField[]
}

export type WorkflowPermissionContext = {
  role: PatientRole
  actionId: ActionId
  globalStatus: GlobalStatus
  quoteAccepted?: boolean
  dateAccepted?: boolean
}

export type PatientPermissionContext = {
  role: PatientRole
  actionId: PermissionActionId
  globalStatus?: GlobalStatus
  quoteAccepted?: boolean
  dateAccepted?: boolean
}
