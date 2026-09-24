import { describe, expect, it } from 'vitest'
import {
  CORNERSTONE_WASM_PUBLIC_DIR,
  DEFAULT_VIEWER_CAPABILITIES,
  parseViewerEngine,
  resolveViewerCapabilities,
} from '../policy'
import {
  CORNERSTONE_PUBLIC_DIR,
  DWV_PUBLIC_PATH_PREFIXES,
  isDwvPublicAssetPath,
} from '../worker-rewrite'
import { isImagingTelemetryEvent } from '../telemetry'

describe('engine capability (U1)', () => {
  it('reste sur dwv par défaut', () => {
    expect(DEFAULT_VIEWER_CAPABILITIES.engine).toBe('dwv')
    expect(resolveViewerCapabilities().engine).toBe('dwv')
  })

  it('bascule Cornerstone via override', () => {
    expect(resolveViewerCapabilities({ engine: 'cornerstone' }).engine).toBe('cornerstone')
  })

  it('parse le flag env (cornerstone / cs / dwv / inconnu)', () => {
    expect(parseViewerEngine('cornerstone')).toBe('cornerstone')
    expect(parseViewerEngine(' CS ')).toBe('cornerstone')
    expect(parseViewerEngine('cornerstone3d')).toBe('cornerstone')
    expect(parseViewerEngine('dwv')).toBe('dwv')
    expect(parseViewerEngine('ohif')).toBeNull()
    expect(parseViewerEngine(undefined)).toBeNull()
    expect(parseViewerEngine('')).toBeNull()
  })

  it('sert les wasm depuis /cornerstone/ (public, hors auth middleware)', () => {
    expect(DEFAULT_VIEWER_CAPABILITIES.cornerstoneWasmBasePath).toBe(CORNERSTONE_WASM_PUBLIC_DIR)
    expect(CORNERSTONE_WASM_PUBLIC_DIR.startsWith(CORNERSTONE_PUBLIC_DIR)).toBe(true)
    expect(DWV_PUBLIC_PATH_PREFIXES).toContain(CORNERSTONE_PUBLIC_DIR)
    expect(isDwvPublicAssetPath('/cornerstone/openjpegwasm_decode.wasm')).toBe(true)
  })

  it('télémétrie : engine cornerstone accepté', () => {
    expect(
      isImagingTelemetryEvent({
        name: 'time_to_first_paint',
        durationMs: 12,
        navMode: 'stack',
        fileCount: 3,
        engine: 'cornerstone',
        outcome: 'ready',
      })
    ).toBe(true)
    expect(
      isImagingTelemetryEvent({
        name: 'series_open_ms',
        durationMs: 0,
        engine: 'ohif',
      })
    ).toBe(false)
  })
})
