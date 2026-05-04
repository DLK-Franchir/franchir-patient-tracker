import { ROLES } from '@/lib/constants'
import type { Role } from '@/lib/constants'
import { canPerformAction, canRolePerformWorkflowAction } from '@/lib/domain/patients/workflow'
import type { ActionAuthorizationResult, ActionId, GlobalStatus } from '@/lib/domain/patients/types'

export type StaffRole = Role

export type ProfileAccess = {
  id?: string
  email?: string | null
  full_name?: string | null
  role?: string | null
}

export const ACTIVE_STAFF_EMAILS = [
  'marcel.mazaltarim@gmail.com',
  'duboisgilles31@gmail.com',
  'duboisgilles31@franchir.eu',
  'erik.boulard@franchir.eu',
  'yves.merillon@franchir.eu',
] as const

const ACTIVE_STAFF_EMAIL_SET = new Set<string>(ACTIVE_STAFF_EMAILS)
const STAFF_ROLES = new Set<string>(ROLES)

export function normalizeEmail(email?: string | null): string {
  return email?.trim().toLowerCase() ?? ''
}

export function isStaffEmail(email?: string | null): boolean {
  return ACTIVE_STAFF_EMAIL_SET.has(normalizeEmail(email))
}

export function assertStaffProfile(
  profile?: ProfileAccess | null
): profile is ProfileAccess & { email: string; role: StaffRole } {
  return Boolean(
    profile && isStaffEmail(profile.email) && profile.role && STAFF_ROLES.has(profile.role)
  )
}

export function isStaffProfile(profile?: ProfileAccess | null): boolean {
  return assertStaffProfile(profile)
}

function unauthorizedProfileResult(): ActionAuthorizationResult {
  return { allowed: false, reason: 'Profil non autorisé.' }
}

function evaluateProfileAction(
  profile: ProfileAccess | null | undefined,
  actionId: 'create_patient' | 'edit_patient_summary' | 'edit_commercial_data' | 'post_message',
  options?: { globalStatus?: GlobalStatus; quoteAccepted?: boolean; dateAccepted?: boolean }
): ActionAuthorizationResult {
  if (!assertStaffProfile(profile)) {
    return unauthorizedProfileResult()
  }

  return canPerformAction({
    role: profile.role,
    actionId,
    globalStatus: options?.globalStatus,
    quoteAccepted: options?.quoteAccepted,
    dateAccepted: options?.dateAccepted,
  })
}

export function canCreatePatientResult(profile?: ProfileAccess | null): ActionAuthorizationResult {
  return evaluateProfileAction(profile, 'create_patient')
}

export function canCreatePatient(profile?: ProfileAccess | null): boolean {
  return canCreatePatientResult(profile).allowed
}

export function canEditCommercialDataResult(
  profile?: ProfileAccess | null,
  globalStatus?: GlobalStatus
): ActionAuthorizationResult {
  return evaluateProfileAction(profile, 'edit_commercial_data', { globalStatus })
}

export function canEditCommercialData(profile?: ProfileAccess | null, globalStatus?: GlobalStatus): boolean {
  return canEditCommercialDataResult(profile, globalStatus).allowed
}

export function canEditPatientSummaryResult(
  profile?: ProfileAccess | null,
  globalStatus?: GlobalStatus
): ActionAuthorizationResult {
  return evaluateProfileAction(profile, 'edit_patient_summary', { globalStatus })
}

export function canEditPatientSummary(profile?: ProfileAccess | null, globalStatus?: GlobalStatus): boolean {
  return canEditPatientSummaryResult(profile, globalStatus).allowed
}

export function canPostPatientMessageResult(
  profile?: ProfileAccess | null,
  globalStatus?: GlobalStatus
): ActionAuthorizationResult {
  return evaluateProfileAction(profile, 'post_message', { globalStatus })
}

export function canPostPatientMessage(profile?: ProfileAccess | null, globalStatus?: GlobalStatus): boolean {
  return canPostPatientMessageResult(profile, globalStatus).allowed
}

export function requireStaffProfile(
  profile?: ProfileAccess | null
): ProfileAccess & { email: string; role: StaffRole } {
  if (!assertStaffProfile(profile)) {
    throw new Error('Unauthorized profile')
  }

  return profile
}

export function canUseWorkflowResult(profile?: ProfileAccess | null): ActionAuthorizationResult {
  return assertStaffProfile(profile) ? { allowed: true } : unauthorizedProfileResult()
}

export function canUseWorkflow(profile?: ProfileAccess | null): boolean {
  return canUseWorkflowResult(profile).allowed
}

export { canRolePerformWorkflowAction }

export function canPerformWorkflowActionResult({
  profile,
  actionId,
  globalStatus,
  quoteAccepted = false,
  dateAccepted = false,
}: {
  profile?: ProfileAccess | null
  actionId: ActionId
  globalStatus: GlobalStatus
  quoteAccepted?: boolean
  dateAccepted?: boolean
}): ActionAuthorizationResult {
  if (!assertStaffProfile(profile)) {
    return unauthorizedProfileResult()
  }

  return canPerformAction({
    role: profile.role,
    actionId,
    globalStatus,
    quoteAccepted,
    dateAccepted,
  })
}

export function canPerformWorkflowAction(params: {
  profile?: ProfileAccess | null
  actionId: ActionId
  globalStatus: GlobalStatus
  quoteAccepted?: boolean
  dateAccepted?: boolean
}): boolean {
  return canPerformWorkflowActionResult(params).allowed
}

export function staffRecipients<T extends ProfileAccess>(
  profiles?: T[] | null,
  actorId?: string
): T[] {
  const seen = new Set<string>()

  return (profiles ?? []).filter(profile => {
    const email = normalizeEmail(profile.email)
    if (!isStaffProfile(profile) || !email || seen.has(email) || profile.id === actorId) {
      return false
    }

    seen.add(email)
    return true
  })
}
