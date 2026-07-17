/**
 * Encode / decode SeriesInstanceUID dans le nom de fichier Storage.
 * Format : `SUID.{base64url}.{stem}.dcm` (parité questionnaires).
 */

const SUID_PREFIX = 'SUID.'

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  const b64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(value, 'utf8').toString('base64')
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(token: string): string | null {
  try {
    const b64 = token.replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    if (typeof atob === 'function') {
      const binary = atob(padded)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
      return new TextDecoder().decode(bytes)
    }
    return Buffer.from(padded, 'base64').toString('utf8')
  } catch {
    return null
  }
}

export function seriesUidFilenamePrefix(seriesInstanceUid: string): string {
  return `${SUID_PREFIX}${toBase64Url(seriesInstanceUid)}`
}

export function extractSeriesUidFromStorageName(storageName: string): string | null {
  const base = storageName.split('/').pop() ?? storageName
  const stripped = base.replace(/^\d+_/, '')
  const match = stripped.match(/^SUID\.([A-Za-z0-9_-]+)\./i)
  if (!match) return null
  const uid = fromBase64Url(match[1]!)
  return uid && uid.length > 0 ? uid : null
}

export function isNumericFolderPrefix(prefix: string): boolean {
  return /^\d+$/.test(prefix)
}
