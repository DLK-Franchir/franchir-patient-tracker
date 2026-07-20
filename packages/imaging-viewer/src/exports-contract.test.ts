import { describe, expect, it } from 'vitest'
import * as pkg from './index'
import * as engine from './engine'
import * as ui from './ui'

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
  'resolveViewerCapabilities',
  'resolveViewerInfoKind',
  'scheduleLayoutRetries',
  'setPoolContainerVisible',
  'shouldPumpParallelLoads',
  'ENCAPSULATED_PDF_SOP_CLASS',
  'classifyDicomContentFromHeader',
  'extractEncapsulatedPdf',
  'fetchEncapsulatedPdfBlobUrl',
  'DWV_ASSETS_WORKERS_SEGMENT',
  'DWV_NEXT_CONFIG_REWRITES',
  'DWV_NEXT_WORKER_MATCHER',
  'DWV_PUBLIC_PATH_PREFIXES',
  'DWV_WORKERS_PUBLIC_DIR',
  'OPENJPEG_PUBLIC_DIR',
  'OPENJPEG_SCRIPT_URL',
  'dwvWorkerRewriteTarget',
  'isDwvPublicAssetPath',
  'IMAGING_TELEMETRY_EVENT_NAMES',
  'emitImagingTelemetry',
  'imagingTelemetryToAnalyticsProps',
  'isImagingTelemetryEvent',
  'isImagingTelemetryEventName',
  'looksLikeWorkerAssetFailure',
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

const REQUIRED_UI_EXPORTS = [
  'DicomViewer',
  'DicomEncapsulatedPdfViewer',
  'DicomJpeg2000FallbackViewer',
  'DicomSeriesHeader',
  'DicomViewerToolbar',
  'DicomViewportErrorOverlay',
  'DicomViewportLoadingOverlay',
  'ViewerInfoBubble',
  'useDwvViewportResize',
  'viewportLoadingMessage',
  'viewerToolHint',
  'viewerMobileHint',
  'decodeJpeg2000',
  'parseDicomForFallback',
  'grayPixelsToRgba',
  'ImagingCardActionMenu',
  'ImagingDownloadScopeDialog',
  'ImagingDeleteConfirmDialog',
] as const

describe('@franchir/imaging-viewer exports contract', () => {
  it('expose la surface policy sans dwv ni chrome React', () => {
    for (const key of REQUIRED_EXPORTS) {
      expect(pkg, key).toHaveProperty(key)
    }
    for (const key of REQUIRED_ENGINE_EXPORTS) {
      expect(pkg).not.toHaveProperty(key)
    }
    for (const key of REQUIRED_UI_EXPORTS) {
      expect(pkg).not.toHaveProperty(key)
    }
  })

  it('expose engine dwv sous /engine', () => {
    for (const key of REQUIRED_ENGINE_EXPORTS) {
      expect(engine, key).toHaveProperty(key)
    }
  })

  it('expose shell React sous /ui', () => {
    for (const key of REQUIRED_UI_EXPORTS) {
      expect(ui, key).toHaveProperty(key)
    }
  })

  it('plafonds pool alignés capabilities', () => {
    expect(pkg.DEFAULT_VIEWER_CAPABILITIES.maxSequentialPool).toBe(pkg.MAX_SEQUENTIAL_POOL)
    expect(pkg.DEFAULT_VIEWER_CAPABILITIES.maxPoolLoadConcurrency).toBe(
      pkg.MAX_POOL_LOAD_CONCURRENCY,
    )
    expect(pkg.DEFAULT_VIEWER_CAPABILITIES.jpeg2000OpenJpegFallback).toBe(true)
    expect(pkg.DEFAULT_VIEWER_CAPABILITIES.encapsulatedPdf).toBe(true)
    expect(pkg.DEFAULT_VIEWER_CAPABILITIES.mp4Native).toBe(false)
  })

  it('resolveViewerCapabilities fusionne les overrides', () => {
    const caps = pkg.resolveViewerCapabilities({ mp4Native: true, encapsulatedPdf: false })
    expect(caps.mp4Native).toBe(true)
    expect(caps.encapsulatedPdf).toBe(false)
    expect(caps.jpeg2000OpenJpegFallback).toBe(true)
    expect(caps.pixelSignalGate).toBe(true)
  })
})
