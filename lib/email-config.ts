import { isStaffProfile } from '@/lib/access-control'

export const EMAIL_FROM = 'FRANCHIR <yves.merillon@franchir.eu>'

export function getEmailForProfile(profile: { role: string; email?: string | null }): string | null {
  return isStaffProfile(profile) ? profile.email ?? null : null
}
