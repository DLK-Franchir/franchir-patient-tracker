/**
 * @franchir/imaging-viewer — contrat + policy (sans dwv / sans React UI).
 * Engine dwv : `@franchir/imaging-viewer/engine`.
 * Shell React + fallback OpenJPEG : `@franchir/imaging-viewer/ui`.
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
