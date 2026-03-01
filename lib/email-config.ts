export const EMAIL_FROM = 'FRANCHIR <yves.merillon@franchir.eu>'

export const ROLE_EMAILS: Record<string, string> = {
  marcel: 'marcel.mazaltarim@gmail.com',
  gilles: 'duboisgilles31@gmail.com',
  admin: 'erik.boulard@franchir.eu',
  franchir: 'erik.boulard@franchir.eu',
}

export function getEmailForProfile(profile: { role: string; email?: string | null }): string | null {
  return ROLE_EMAILS[profile.role] ?? null
}
