/**
 * @franchir/imaging-viewer — contrat + policy (sans dwv / sans React UI).
 * Engine dwv : `@franchir/imaging-viewer/engine`.
 * Host React + chrome + PDF DOC + fallback OpenJPEG : `@franchir/imaging-viewer/ui`.
 * Rewrite workers Next : `@franchir/imaging-viewer/worker-rewrite` (aussi re-exporté ici).
 * SoT = franchir-patient-tracker. Sync → questionnaires via `npm run imaging-viewer:sync`.
 */

export type {
  DicomTool,
  DicomViewerProps,
  DwvLayoutApp,
  DwvLoadEvent,
  ImagingPoolEntry,
  ImagingSeries,
  ImagingViewerItem,
  NavMode,
  PoolEntry,
  PoolEntryStatus,
  ViewerCapabilities,
  ViewerInfoKind,
  ViewerSeries,
  ViewerStatus,
} from './contract'

export {
  DEFAULT_VIEWER_CAPABILITIES,
  LAYOUT_RETRY_DELAYS_MS,
  MAX_POOL_LOAD_CONCURRENCY,
  MAX_SEQUENTIAL_POOL,
  RENDER_READY_DELAYS_MS,
  SEQUENTIAL_LOCALIZER_ORIENTATION_MSG,
  SEQUENTIAL_ORIENTATION_FALLBACK_MSG,
  STACK_LOAD_FAIL_MS,
  STACK_PROGRESS_FALLBACK_MS,
  STACK_RENDER_READY_MS,
  WL_PRESETS,
  formatDicomLoadError,
  isStackOrientationMismatch,
  isUnsupportedJpeg2000Error,
  nextLayerGroupId,
  orientationFallbackMessage,
  resetLayerGroupIdCounterForTests,
  resolveViewerCapabilities,
  resolveViewerInfoKind,
  type WlPresetId,
} from './policy'

export {
  POOL_BOOTSTRAP_INDEX,
  nextPoolLoadIndex,
  shouldPumpParallelLoads,
} from './pool-plan'

export {
  clearLayoutTimers,
  ensureDwvVisible,
  refreshDwvLayout,
  scheduleLayoutRetries,
  setPoolContainerVisible,
} from './layout'

export { hasPixelSignal } from './pixel-signal'

export {
  ENCAPSULATED_PDF_SOP_CLASS,
  classifyDicomContentFromHeader,
  extractEncapsulatedPdf,
  fetchEncapsulatedPdfBlobUrl,
  type DicomContentKind,
} from './encapsulated-pdf'

export {
  DWV_ASSETS_WORKERS_SEGMENT,
  DWV_NEXT_CONFIG_REWRITES,
  DWV_NEXT_WORKER_MATCHER,
  DWV_PUBLIC_PATH_PREFIXES,
  DWV_WORKERS_PUBLIC_DIR,
  OPENJPEG_PUBLIC_DIR,
  OPENJPEG_SCRIPT_URL,
  dwvWorkerRewriteTarget,
  isDwvPublicAssetPath,
} from './worker-rewrite'

export {
  IMAGING_TELEMETRY_EVENT_NAMES,
  emitImagingTelemetry,
  imagingTelemetryToAnalyticsProps,
  isImagingTelemetryEvent,
  isImagingTelemetryEventName,
  looksLikeWorkerAssetFailure,
  nowMs,
  type ImagingTelemetryEngine,
  type ImagingTelemetryEvent,
  type ImagingTelemetryEventName,
  type ImagingTelemetryHandler,
  type ImagingTelemetryNavMode,
  type ImagingTelemetryOutcome,
} from './telemetry'
