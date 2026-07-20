/**
 * Observabilité produit Imaging — événements client sans PHI.
 * Pas d’URL (tokens signés), pas d’identifiant patient / série nominatif.
 * Les apps branchent `onImagingTelemetry` sur leur analytics (gtag / plausible / …).
 *
 * P8 : raisons `dicom_export` stables (dont réservées async P7), seuils d’alerte,
 * résumé contrat pour `/api/internal/imaging/telemetry-summary`.
 */

/** Noms stables — documentés dans PRODUCT.md + docs/ops/IMAGING_TELEMETRY.md. */
export const IMAGING_TELEMETRY_EVENT_NAMES = [
  'time_to_first_paint',
  'openjpeg_fallback',
  'ready_without_pixels',
  'series_open_ms',
  'worker_asset_fail',
  /** Export ZIP série / étude (adapters app ; pas de PHI / pas d’URL). */
  'dicom_export',
] as const

export type ImagingTelemetryEventName = (typeof IMAGING_TELEMETRY_EVENT_NAMES)[number]

/**
 * Prefixe analytics app (`imaging_<name>`).
 * Stable pour dashboards GA4 / Plausible — ne pas renommer sans migration ops.
 */
export const IMAGING_TELEMETRY_ANALYTICS_PREFIX = 'imaging_' as const

/**
 * Raisons `dicom_export.reason` (snake_case).
 * P7 async ZIP / jobs Storage : utiliser les clés `study_async*` uniquement —
 * ne pas inventer d’autres noms d’événement.
 */
export const DICOM_EXPORT_REASONS = [
  'series',
  'series_fail',
  'study_single',
  'study_single_fail',
  'study_chunked',
  'study_chunk_fail',
  'study_plan_fail',
  'study_download_fail',
  /** Réservé P7 — job async terminé (ZIP prêt / téléchargé). */
  'study_async',
  /** Réservé P7 — échec job / fetch async. */
  'study_async_fail',
  /** Réservé P7 — timeout / abandon côté client. */
  'study_async_timeout',
] as const

export type DicomExportReason = (typeof DICOM_EXPORT_REASONS)[number]

/** Raisons déjà émises par les adapters sync (P5) — P7 n’y touche pas. */
export const DICOM_EXPORT_SYNC_REASONS = [
  'series',
  'series_fail',
  'study_single',
  'study_single_fail',
  'study_chunked',
  'study_chunk_fail',
  'study_plan_fail',
  'study_download_fail',
] as const satisfies readonly DicomExportReason[]

/** Raisons réservées lane P7 (async ZIP) — coordination par nom uniquement. */
export const DICOM_EXPORT_ASYNC_REASONS = [
  'study_async',
  'study_async_fail',
  'study_async_timeout',
] as const satisfies readonly DicomExportReason[]

/**
 * Seuils ops documentés (P8) — guide d’alerte produit, pas un moteur d’alerting.
 * Fenêtre typique : 1 h rolling en prod (Marcel + clinicien).
 */
export const IMAGING_TELEMETRY_ALERT_THRESHOLDS = {
  /** Events `ready_without_pixels` / h → suspect workers / gate pixels. */
  readyWithoutPixelsPerHour: 5,
  /** Events `worker_asset_fail` / h → rewrite `/_next/.../assets/workers` cassé. */
  workerAssetFailPerHour: 3,
  /** Part d’exports `outcome=error` parmi `dicom_export` (0–1). */
  dicomExportErrorRate: 0.2,
  /** p95 `time_to_first_paint.duration_ms` (ms). */
  timeToFirstPaintP95Ms: 15_000,
  /** p95 `series_open_ms.duration_ms` (ms). */
  seriesOpenP95Ms: 30_000,
  /** Minimum d’échantillons avant d’appliquer un seuil taux / p95. */
  minSamplesForRateOrP95: 20,
} as const

export type ImagingTelemetryAlertThresholds = typeof IMAGING_TELEMETRY_ALERT_THRESHOLDS

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
   * Code court non-PHI (ex. `empty_pixel_buffer`, `worker_script`,
   * `study_chunked`, `study_async`).
   * Jamais de message dwv brut ni d’URL.
   */
  reason?: string
}

export type ImagingTelemetryHandler = (event: ImagingTelemetryEvent) => void

/** Horloge ms — à appeler hors render (effects / handlers), pas dans useRef(…). */
export function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

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

export function isDicomExportReason(value: unknown): value is DicomExportReason {
  return typeof value === 'string' && (DICOM_EXPORT_REASONS as readonly string[]).includes(value)
}

/** Nom d’événement analytics (`imaging_time_to_first_paint`, …). */
export function imagingTelemetryAnalyticsEventName(name: ImagingTelemetryEventName): string {
  return `${IMAGING_TELEMETRY_ANALYTICS_PREFIX}${name}`
}

/**
 * Résumé contrat non-PHI pour ops / smoke (pas de compteurs live, pas de PHI).
 * Consommé par `GET /api/internal/imaging/telemetry-summary`.
 */
export function buildImagingTelemetryContractSummary(): {
  version: 1
  analyticsPrefix: typeof IMAGING_TELEMETRY_ANALYTICS_PREFIX
  eventNames: ImagingTelemetryEventName[]
  analyticsEventNames: string[]
  dicomExportReasons: {
    all: DicomExportReason[]
    sync: DicomExportReason[]
    asyncReserved: DicomExportReason[]
  }
  alertThresholds: ImagingTelemetryAlertThresholds
  neverInclude: string[]
} {
  return {
    version: 1,
    analyticsPrefix: IMAGING_TELEMETRY_ANALYTICS_PREFIX,
    eventNames: [...IMAGING_TELEMETRY_EVENT_NAMES],
    analyticsEventNames: IMAGING_TELEMETRY_EVENT_NAMES.map(imagingTelemetryAnalyticsEventName),
    dicomExportReasons: {
      all: [...DICOM_EXPORT_REASONS],
      sync: [...DICOM_EXPORT_SYNC_REASONS],
      asyncReserved: [...DICOM_EXPORT_ASYNC_REASONS],
    },
    alertThresholds: { ...IMAGING_TELEMETRY_ALERT_THRESHOLDS },
    neverInclude: [
      'patient_id',
      'patient_name',
      'email',
      'series_label',
      'series_instance_uid',
      'signed_url',
      'storage_path',
      'raw_dwv_error',
    ],
  }
}
