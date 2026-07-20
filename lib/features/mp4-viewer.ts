/**
 * Lecteur / upload MP4 — Marcel + clinicien (parité via `getAppViewerCapabilities`).
 *
 * Activé si :
 * - `NEXT_PUBLIC_ENABLE_MP4_VIEWER` truthy (`true` / `1` / `yes`), ou
 * - alias `NEXT_PUBLIC_MP4_VIEWER` truthy (ex. `1`), ou
 * - déploiement Vercel Preview, ou
 * - dev local.
 *
 * Prod : package default `mp4Native: false` — flip ops explicite (pas de
 * activation silencieuse en production). Voir `docs/ops/IMAGING_ADAPTERS.md`.
 */

function isEnvFlagTruthy(value: string | undefined): boolean {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized === 'true' || normalized === '1' || normalized === 'yes'
}

export function isMp4ViewerEnabled(): boolean {
  if (isEnvFlagTruthy(process.env.NEXT_PUBLIC_ENABLE_MP4_VIEWER)) return true
  if (isEnvFlagTruthy(process.env.NEXT_PUBLIC_MP4_VIEWER)) return true
  if (process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview') return true
  if (process.env.NODE_ENV === 'development') return true
  return false
}

export const MP4_MIME_TYPE = 'video/mp4'

export const MP4_MIME_TYPES = new Set([MP4_MIME_TYPE, 'video/x-m4v'])

export const MP4_EXTENSIONS = new Set(['mp4', 'm4v'])

/** Suffixe `accept` HTML pour les inputs fichier (vide si MP4 désactivé). */
export function getVideoAcceptSuffix(): string {
  if (!isMp4ViewerEnabled()) return ''
  return ',.mp4,.m4v,video/mp4,video/x-m4v'
}

/** Attribut `accept` complet — zone upload Marcel (tracker). */
export function getDocumentAcceptAttribute(): string {
  return `.dcm,.dicom,.pdf,.jpg,.jpeg,.png,.webp,.gif,application/dicom,application/pdf,image/*${getVideoAcceptSuffix()}`
}

/** Attribut `accept` — imagerie patient / clinicien (questionnaires). */
export function getImagingAcceptAttribute(): string {
  return `image/*,.pdf,.dcm,.dicom,application/dicom${getVideoAcceptSuffix()}`
}

export function isMp4File(name: string, mimeType?: string | null): boolean {
  const ext = name.split('.').pop()?.toLowerCase()
  const mime = mimeType?.toLowerCase().trim()
  return Boolean((ext && MP4_EXTENSIONS.has(ext)) || (mime && MP4_MIME_TYPES.has(mime)))
}

/** MIME hint for `<source type>` — m4v prefers video/x-m4v. */
export function mp4SourceMimeType(nameOrUrl: string): string {
  const base = nameOrUrl.split('?')[0]?.toLowerCase() ?? ''
  return base.endsWith('.m4v') ? 'video/x-m4v' : MP4_MIME_TYPE
}
