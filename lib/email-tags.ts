/**
 * Tags Resend pour corrélation dashboard / MCP / webhooks.
 * Valeurs ASCII courtes uniquement (contraintes Resend).
 */
export type ResendEmailTag = { name: string; value: string }

export function staffEmailTags(kind: string, extra?: Record<string, string>): ResendEmailTag[] {
  const tags: ResendEmailTag[] = [
    { name: 'app', value: 'tracker' },
    { name: 'kind', value: kind },
  ]
  if (extra) {
    for (const [name, value] of Object.entries(extra)) {
      if (value) tags.push({ name, value })
    }
  }
  return tags
}
