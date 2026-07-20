/**
 * Observabilité produit Imaging — événements client sans PHI.
 * Pas d’URL (tokens signés), pas d’identifiant patient / série nominatif.
 * Les apps branchent `onImagingTelemetry` sur leur analytics (gtag / plausible / …).
 */

/** Noms stables — documentés dans PRODUCT.md + docs/ops/IMAGING_TELEMETRY.md. */
export const IMAGING_TELEMETRY_EVENT_NAMES = [
  'time_to_first_paint',
  'openjpeg_fallback',
  'ready_without_pixels',
  'series_open_ms',
  'worker_asset_fail',
] as const

export type ImagingTelemetryEventName = (typeof IMAGING_TELEMETRY_EVENT_NAMES)[number]

export type ImagingTelemetryEngine = 'dwv' | 'openjpeg'

export type ImagingTelemetryOutcome = 'ready' | 'error' | 'fallback'

/** Aligné sur `NavMode` du contrat (évite import circulaire contract ↔ telemetry). */
export type ImagingTelemetryNavMode = 'stack' | 'sequential'

/** Payload client-safe (valeurs scalaires uniquement). */
export type ImagingTelemetryEvent = {
  name: ImagingTelemetryEventName
  /** Durée ms depuis l’ouverture de série / démarrage du viewer. */
  durationMs?: number
  navMode?: ImagingTelemetryNavMode
  fileCount?: number
  engine?: ImagingTelemetryEngine
  outcome?: ImagingTelemetryOutcome
  /**
   * Code court non-PHI (ex. `empty_pixel_buffer`, `worker_script`).
   * Jamais de message dwv brut ni d’URL.
   */
  reason?: string
}

export type ImagingTelemetryHandler = (event: ImagingTelemetryEvent) => void

const NAME_SET = new Set<string>(IMAGING_TELEMETRY_EVENT_NAMES)

const REASON_RE = /^[a-z][a-z0-9_]{0,63}$/

/** True si le message d’erreur dwv / runtime évoque un échec de chargement worker. */
export function looksLikeWorkerAssetFailure(message: string | null | undefined): boolean {
  if (!message?.trim()) return false
  const lower = message.toLowerCase()
  return (
    lower.includes('worker') ||
    lower.includes('importscripts') ||
    lower.includes('failed to construct') ||
    (lower.includes('assets/workers') &&
      (lower.includes('404') || lower.includes('failed to fetch') || lower.includes('load')))
  )
}

export function isImagingTelemetryEventName(value: unknown): value is ImagingTelemetryEventName {
  return typeof value === 'string' && NAME_SET.has(value)
}

export function isImagingTelemetryEvent(value: unknown): value is ImagingTelemetryEvent {
  if (!value || typeof value !== 'object') return false
  const e = value as Record<string, unknown>
  if (!isImagingTelemetryEventName(e.name)) return false
  if (e.durationMs !== undefined && (typeof e.durationMs !== 'number' || !Number.isFinite(e.durationMs))) {
    return false
  }
  if (e.navMode !== undefined && e.navMode !== 'stack' && e.navMode !== 'sequential') return false
  if (e.fileCount !== undefined && (typeof e.fileCount !== 'number' || !Number.isFinite(e.fileCount))) {
    return false
  }
  if (e.engine !== undefined && e.engine !== 'dwv' && e.engine !== 'openjpeg') return false
  if (
    e.outcome !== undefined &&
    e.outcome !== 'ready' &&
    e.outcome !== 'error' &&
    e.outcome !== 'fallback'
  ) {
    return false
  }
  if (e.reason !== undefined && (typeof e.reason !== 'string' || !REASON_RE.test(e.reason))) {
    return false
  }
  return true
}

/**
 * Props analytics (gtag / plausible) — scalaires uniquement, sans URL / PHI.
 * Ignore les champs absents ; tronque durationMs à l’entier.
 */
export function imagingTelemetryToAnalyticsProps(
  event: ImagingTelemetryEvent,
): Record<string, string | number> {
  const props: Record<string, string | number> = { name: event.name }
  if (typeof event.durationMs === 'number' && Number.isFinite(event.durationMs)) {
    props.duration_ms = Math.max(0, Math.round(event.durationMs))
  }
  if (event.navMode) props.nav_mode = event.navMode
  if (typeof event.fileCount === 'number' && Number.isFinite(event.fileCount)) {
    props.file_count = Math.max(0, Math.round(event.fileCount))
  }
  if (event.engine) props.engine = event.engine
  if (event.outcome) props.outcome = event.outcome
  if (event.reason) props.reason = event.reason
  return props
}

/** Appelle le handler sans jamais faire planter le viewer. */
export function emitImagingTelemetry(
  handler: ImagingTelemetryHandler | null | undefined,
  event: ImagingTelemetryEvent,
): void {
  if (!handler) return
  if (!isImagingTelemetryEvent(event)) return
  try {
    handler(event)
  } catch {
    /* analytics must not break decode / paint */
  }
}
