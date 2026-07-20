import { describe, expect, it } from 'vitest'
import * as pkg from './index'

/** Surface publique stable — les shims apps doivent re-exporter ces clés. */
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
  'addWindowLevelPresets',
  'clearLayoutTimers',
  'createDwvApp',
  'destroyDwvApp',
  'ensureDwvVisible',
  'formatDicomLoadError',
  'hasPixelSignal',
  'hasRenderableImage',
  'isStackOrientationMismatch',
  'isUnsupportedJpeg2000Error',
  'nextLayerGroupId',
  'nextPoolLoadIndex',
  'orientationFallbackMessage',
  'readSliceCount',
  'readSliceIndex',
  'refreshDwvLayout',
  'resolveViewerInfoKind',
  'scheduleLayoutRetries',
  'setPoolContainerVisible',
  'shouldPumpParallelLoads',
  'useDicomSequentialNavigation',
  'useDicomSequentialPool',
  'useDicomStackMode',
  'waitForRenderableImage',
] as const

describe('@franchir/imaging-viewer exports contract', () => {
  it('expose la surface P1 attendue', () => {
    for (const key of REQUIRED_EXPORTS) {
      expect(pkg, key).toHaveProperty(key)
    }
  })

  it('plafonds pool alignés capabilities', () => {
    expect(pkg.DEFAULT_VIEWER_CAPABILITIES.maxSequentialPool).toBe(pkg.MAX_SEQUENTIAL_POOL)
    expect(pkg.DEFAULT_VIEWER_CAPABILITIES.maxPoolLoadConcurrency).toBe(
      pkg.MAX_POOL_LOAD_CONCURRENCY,
    )
  })
})
