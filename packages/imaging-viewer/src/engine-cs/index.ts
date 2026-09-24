/**
 * Engine Cornerstone3D (U1) — client only. Importer uniquement depuis le host
 * `/ui` (chargé en dynamic import quand `capabilities.engine === 'cornerstone'`).
 * Peer deps : `@cornerstonejs/core`, `@cornerstonejs/dicom-image-loader`.
 * Les gestes (fenêtrage / zoom / pan / coupes) sont dans `interaction.ts`.
 * Les mesures U2 sont un calque SVG : `@cornerstonejs/tools` n'est pas chargé
 * (son worker `computeWorker` bloque le build Turbopack).
 */

export {
  ensureCornerstone,
  resetCornerstoneInitForTests,
  type CornerstoneInitOptions,
} from './init'
export {
  CS_RENDER_READY_FALLBACK_MS,
  CS_VIEWPORT_BACKGROUND,
  toImageId,
  useCornerstoneStack,
  type CsStackHandle,
  type CsStackParams,
} from './stack'
export {
  SCROLL_DRAG_PX_PER_SLICE,
  WL_DRAG_FRACTION_PER_PX,
  ZOOM_MAX,
  ZOOM_MIN,
  attachCsInteractions,
  clampZoom,
  gestureForPointer,
  nextWindowLevel,
  type CsInteractionOptions,
} from './interaction'
export {
  csFlip,
  csGoToSlice,
  csNavigateSlice,
  csReadWindowLevel,
  csResetView,
  csResetWindowLevel,
  csSetWindowLevel,
  csSliceCount,
  csSliceIndex,
  csToggleInvert,
  csZoomStep,
} from './viewport'
