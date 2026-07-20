import { SIGNED_URL_TTL_SECONDS } from '@/lib/documents/patient-documents'

/**
 * Soft-refresh window for imagerie signed URLs (TTL 30 min).
 * Refresh ~5 min before expiry so open/nav does not hit JWT exp mid-load.
 */
export const SIGNED_URL_SOFT_REFRESH_BEFORE_MS = 5 * 60 * 1000

export const SIGNED_URL_SOFT_REFRESH_AFTER_MS = Math.max(
  60_000,
  SIGNED_URL_TTL_SECONDS * 1000 - SIGNED_URL_SOFT_REFRESH_BEFORE_MS,
)

/**
 * True when the client listing should mint fresh signed URLs before open.
 * `listedAtMs` null/undefined ⇒ treat as stale (force refresh).
 */
export function isSignedUrlListingStale(
  listedAtMs: number | null | undefined,
  nowMs: number = Date.now(),
  softRefreshAfterMs: number = SIGNED_URL_SOFT_REFRESH_AFTER_MS,
): boolean {
  if (listedAtMs == null || !Number.isFinite(listedAtMs)) return true
  return nowMs - listedAtMs >= softRefreshAfterMs
}
