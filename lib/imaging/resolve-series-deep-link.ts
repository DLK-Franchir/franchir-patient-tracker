/**
 * Deep-link `?series=` — match a viewer series by SeriesInstanceUID or groupId.
 * App routing helper (not PHI-aware; never log the raw query in prod).
 */

export type SeriesDeepLinkCandidate = {
  id: string
  /** Grouping key from `@franchir/imaging` (e.g. `suid:1.2.3`, `series:SE000005`). */
  groupId?: string | null
}

export function normalizeSeriesDeepLinkQuery(
  raw: string | null | undefined,
): string | null {
  if (raw == null) return null
  let decoded = raw
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    decoded = raw
  }
  const q = decoded.trim()
  return q.length > 0 ? q : null
}

/**
 * Resolve `?series=` to a viewer item id, or null if no match.
 * Accepts: full item id, groupId, `suid:<uid>`, or bare SeriesInstanceUID.
 */
export function resolveSeriesDeepLinkId(
  query: string | null | undefined,
  candidates: SeriesDeepLinkCandidate[],
): string | null {
  const q = normalizeSeriesDeepLinkQuery(query)
  if (!q || candidates.length === 0) return null

  const exactId = candidates.find((c) => c.id === q)
  if (exactId) return exactId.id

  const exactGroup = candidates.find((c) => c.groupId === q)
  if (exactGroup) return exactGroup.id

  const suidForm = q.startsWith('suid:') ? q : `suid:${q}`
  const bySuid = candidates.find(
    (c) => c.groupId === suidForm || c.id.endsWith(`-${suidForm}`),
  )
  if (bySuid) return bySuid.id

  const byGroupSuffix = candidates.find(
    (c) => c.groupId != null && c.groupId.length > 0 && c.id.endsWith(`-${c.groupId}`) && c.groupId === q,
  )
  if (byGroupSuffix) return byGroupSuffix.id

  const byIdSuffix = candidates.find((c) => c.id.endsWith(`-${q}`))
  if (byIdSuffix) return byIdSuffix.id

  return null
}
