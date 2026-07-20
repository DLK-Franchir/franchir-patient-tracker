import { describe, expect, it } from 'vitest'
import {
  SIGNED_URL_SOFT_REFRESH_AFTER_MS,
  isSignedUrlListingStale,
} from '@/lib/documents/signed-url-freshness'

describe('isSignedUrlListingStale', () => {
  it('traite listedAt absent comme expire', () => {
    expect(isSignedUrlListingStale(null)).toBe(true)
    expect(isSignedUrlListingStale(undefined)).toBe(true)
  })

  it('reste frais juste apres le listing', () => {
    const now = 1_700_000_000_000
    expect(isSignedUrlListingStale(now, now)).toBe(false)
    expect(isSignedUrlListingStale(now - 60_000, now)).toBe(false)
  })

  it('devient stale apres la fenetre soft-refresh (~25 min)', () => {
    const now = 1_700_000_000_000
    expect(isSignedUrlListingStale(now - SIGNED_URL_SOFT_REFRESH_AFTER_MS, now)).toBe(true)
    expect(isSignedUrlListingStale(now - SIGNED_URL_SOFT_REFRESH_AFTER_MS + 1, now)).toBe(false)
  })
})
