const DEFAULT_STAFF_REDIRECT = '/dashboard'

/** Empêche une redirection ouverte après login (`?redirect=`). */
export function safeStaffRedirectPath(value?: string | null): string {
  if (!value) return DEFAULT_STAFF_REDIRECT

  const path = value.trim()
  if (!path.startsWith('/')) return DEFAULT_STAFF_REDIRECT
  if (path.startsWith('//') || path.startsWith('/\\')) return DEFAULT_STAFF_REDIRECT
  if (path.includes('://')) return DEFAULT_STAFF_REDIRECT

  const pathname = path.split('?')[0] ?? path
  if (pathname === '/login' || pathname.startsWith('/auth')) {
    return DEFAULT_STAFF_REDIRECT
  }

  return path
}
