/** Sujets autorisés pour un message libre saisi par le staff. */
export type FreeMessageTopic = 'medical' | 'commercial'

/**
 * Normalise le `topic` reçu du composer. Toute valeur inconnue retombe sur
 * `medical` (comportement historique) ; `system` / `audit` sont réservés aux
 * événements générés par l'application.
 */
export function parseMessageTopic(raw: unknown): FreeMessageTopic {
  return raw === 'commercial' ? 'commercial' : 'medical'
}
