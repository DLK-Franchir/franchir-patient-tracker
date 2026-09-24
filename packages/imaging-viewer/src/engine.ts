/**
 * Engine dwv — importer uniquement depuis les modules visionneuse client.
 * Ne pas importer depuis des chemins SSR (ex. upload-guidance) : le barrel
 * principal `@franchir/imaging-viewer` reste sans dépendance dwv.
 */

export {
  addWindowLevelPresets,
  createDwvApp,
  destroyDwvApp,
  flipViewLayer,
  hasRenderableImage,
  readModality,
  readSliceCount,
  readSliceIndex,
  readWindowLevel,
  resetWindowLevel,
  setSliceIndex,
  toggleInvert,
  waitForRenderableImage,
} from './dwv-app'

export { useDicomStackMode, type StackModeParams } from './stack'
export { useDicomSequentialPool, type PoolModeParams } from './pool'
export { useDicomSequentialNavigation, type SequentialNavParams } from './sequential'
