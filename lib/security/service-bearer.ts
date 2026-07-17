import { timingSafeEqual } from 'node:crypto'

/**
 * Comparaison timing-safe d'un header `Authorization: Bearer <token>`
 * contre un (ou plusieurs) secrets attendus.
 */
export function isValidBearer(
  authorization: string | null | undefined,
  ...expectedTokens: Array<string | undefined>
): boolean {
  if (!authorization) return false
  const [scheme, token] = authorization.trim().split(/\s+/, 2)
  if (scheme?.toLowerCase() !== 'bearer' || !token) return false

  const received = Buffer.from(token)
  for (const expected of expectedTokens) {
    if (!expected) continue
    const expectedBuf = Buffer.from(expected)
    if (received.length !== expectedBuf.length) continue
    if (timingSafeEqual(received, expectedBuf)) return true
  }
  return false
}
