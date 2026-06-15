export type StaffRole = 'marcel' | 'franchir' | 'gilles' | 'admin'

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
const STAFF_ROLES = new Set<string>(['marcel', 'franchir', 'gilles', 'admin'])

export function normalizeEmail(email?: string | null): string {
  return email?.trim().toLowerCase() ?? ''
}

export function isStaffEmail(email?: string | null): boolean {
  return ACTIVE_STAFF_EMAIL_SET.has(normalizeEmail(email))
}

export function assertStaffProfile(profile?: ProfileAccess | null): profile is ProfileAccess & { email: string; role: StaffRole } {
  return Boolean(profile && isStaffEmail(profile.email) && profile.role && STAFF_ROLES.has(profile.role))
}

export function isStaffProfile(profile?: ProfileAccess | null): boolean {
  return assertStaffProfile(profile)
}

export function canCreatePatient(profile?: ProfileAccess | null): boolean {
  if (!assertStaffProfile(profile)) {
    return false
  }

  return profile.role === 'marcel' || profile.role === 'franchir' || profile.role === 'admin'
}

export function canEditCommercialData(profile?: ProfileAccess | null): boolean {
  return canCreatePatient(profile)
}

/**
 * Upload / suppression des fichiers patients (DICOM + documents) : réservé aux
 * créateurs de dossier (marcel / franchir / admin). La simple consultation des
 * fichiers reste ouverte à tout le staff actif (cf. isStaffProfile).
 */
export function canManagePatientDocuments(profile?: ProfileAccess | null): boolean {
  return canCreatePatient(profile)
}

export function canEditPatientSummary(profile?: ProfileAccess | null): boolean {
  if (!assertStaffProfile(profile)) {
    return false
  }

  return profile.role === 'marcel' || profile.role === 'admin'
}

/** Assignation / changement du chirurgien responsable (sync questionnaires). */
export function canAssignSurgeon(profile?: ProfileAccess | null): boolean {
  if (!assertStaffProfile(profile)) {
    return false
  }

  return (
    profile.role === 'marcel' ||
    profile.role === 'franchir' ||
    profile.role === 'gilles' ||
    profile.role === 'admin'
  )
}

export function requireStaffProfile(profile?: ProfileAccess | null): ProfileAccess & { email: string; role: StaffRole } {
  if (!assertStaffProfile(profile)) {
    throw new Error('Unauthorized profile')
  }

  return profile
}

export function canUseWorkflow(profile?: ProfileAccess | null): boolean {
  return isStaffProfile(profile)
}

export function staffRecipients<T extends ProfileAccess>(profiles?: T[] | null, actorId?: string): T[] {
  const seen = new Set<string>()

  return (profiles ?? []).filter((profile) => {
    const email = normalizeEmail(profile.email)
    if (!isStaffProfile(profile) || !email || seen.has(email) || profile.id === actorId) {
      return false
    }

    seen.add(email)
    return true
  })
}
