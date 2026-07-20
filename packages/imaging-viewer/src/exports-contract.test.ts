import { describe, expect, it } from 'vitest'
import * as pkg from './index'
import * as engine from './engine'

/** Surface publique sans dwv — safe pour chemins SSR / upload-guidance. */
const REQUIRED_EXPORTS = [
  'DEFAULT_VIEWER_CAPABILITIES',
  'LAYOUT_RETRY_DELAYS_MS',
  'MAX_POOL_LOAD_CONCURRENCY',
  'MAX_SEQUENTIAL_POOL',
  'POOL_BOOTSTRAP_INDEX',
  'RENDER_READY_DELAYS_MS',
  'SEQUENTIAL_LOCALIZER_ORIENTATION_MSG',
  'SEQUENTIAL_ORIENTATION_FALLBACK_MSG',
  'STACK_LOAD_FAIL_MS',
  'STACK_PROGRESS_FALLBACK_MS',
  'STACK_RENDER_READY_MS',
  'WL_PRESETS',
  'clearLayoutTimers',
  'ensureDwvVisible',
  'formatDicomLoadError',
  'hasPixelSignal',
  'isStackOrientationMismatch',
  'isUnsupportedJpeg2000Error',
  'nextLayerGroupId',
  'nextPoolLoadIndex',
  'orientationFallbackMessage',
  'refreshDwvLayout',
  'resolveViewerInfoKind',
  'scheduleLayoutRetries',
  'setPoolContainerVisible',
  'shouldPumpParallelLoads',
] as const

const REQUIRED_ENGINE_EXPORTS = [
  'addWindowLevelPresets',
  'createDwvApp',
  'destroyDwvApp',
  'hasRenderableImage',
  'readSliceCount',
  'readSliceIndex',
  'useDicomSequentialNavigation',
  'useDicomSequentialPool',
  'useDicomStackMode',
  'waitForRenderableImage',
] as const

describe('@franchir/imaging-viewer exports contract', () => {
  it('expose la surface policy sans dwv', () => {
    for (const key of REQUIRED_EXPORTS) {
      expect(pkg, key).toHaveProperty(key)
    }
    for (const key of REQUIRED_ENGINE_EXPORTS) {
      expect(pkg).not.toHaveProperty(key)
    }
  })

  it('expose engine dwv sous /engine', () => {
    for (const key of REQUIRED_ENGINE_EXPORTS) {
      expect(engine, key).toHaveProperty(key)
    }
  })

  it('plafonds pool alignés capabilities', () => {
    expect(pkg.DEFAULT_VIEWER_CAPABILITIES.maxSequentialPool).toBe(pkg.MAX_SEQUENTIAL_POOL)
    expect(pkg.DEFAULT_VIEWER_CAPABILITIES.maxPoolLoadConcurrency).toBe(
      pkg.MAX_POOL_LOAD_CONCURRENCY,
    )
  })
})
