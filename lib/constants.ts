export const ROLES = ['marcel', 'gilles', 'franchir', 'admin'] as const
export type Role = (typeof ROLES)[number]

export const DB_STATUS_CODES = [
  'draft',
  'prospect_created',
  'medical_review',
  'validated_medical',
  'need_info',
  'rejected_medical',
  'surgery_scheduled',
] as const
export type DbStatusCode = (typeof DB_STATUS_CODES)[number]
