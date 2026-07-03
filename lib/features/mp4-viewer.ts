/**
 * Lecteur MP4 natif — feature flag staging.
 *
 * Activer sur l'environnement staging Vercel :
 *   NEXT_PUBLIC_ENABLE_MP4_VIEWER=true
 *
 * Tant que le flag est absent/false, les MP4 restent traités comme « other »
 * (téléchargement uniquement) et ne sont pas acceptés à l'upload.
 */
export function isMp4ViewerEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_MP4_VIEWER === 'true'
}

export const MP4_MIME_TYPE = 'video/mp4'

export const MP4_EXTENSIONS = new Set(['mp4', 'm4v'])
