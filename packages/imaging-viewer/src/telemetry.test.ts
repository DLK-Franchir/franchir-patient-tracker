import { describe, expect, it, vi } from 'vitest'
import {
  IMAGING_TELEMETRY_EVENT_NAMES,
  emitImagingTelemetry,
  imagingTelemetryToAnalyticsProps,
  isImagingTelemetryEvent,
  isImagingTelemetryEventName,
  looksLikeWorkerAssetFailure,
  type ImagingTelemetryEvent,
} from './telemetry'

describe('imaging telemetry event shapes', () => {
  it('expose les 5 noms produit stables', () => {
    expect([...IMAGING_TELEMETRY_EVENT_NAMES].sort()).toEqual(
      [
        'openjpeg_fallback',
        'ready_without_pixels',
        'series_open_ms',
        'time_to_first_paint',
        'worker_asset_fail',
      ].sort(),
    )
  })

  it('valide un événement TTFP complet', () => {
    const event: ImagingTelemetryEvent = {
      name: 'time_to_first_paint',
      durationMs: 1234.6,
      navMode: 'stack',
      fileCount: 12,
      engine: 'dwv',
      outcome: 'ready',
    }
    expect(isImagingTelemetryEvent(event)).toBe(true)
    expect(imagingTelemetryToAnalyticsProps(event)).toEqual({
      name: 'time_to_first_paint',
      duration_ms: 1235,
      nav_mode: 'stack',
      file_count: 12,
      engine: 'dwv',
      outcome: 'ready',
    })
  })

  it('valide ready_without_pixels + worker_asset_fail avec reason snake_case', () => {
    expect(
      isImagingTelemetryEvent({
        name: 'ready_without_pixels',
        durationMs: 800,
        navMode: 'sequential',
        fileCount: 1,
        engine: 'dwv',
        reason: 'empty_pixel_buffer',
      }),
    ).toBe(true)
    expect(
      isImagingTelemetryEvent({
        name: 'worker_asset_fail',
        reason: 'worker_script',
        engine: 'dwv',
      }),
    ).toBe(true)
  })

  it('rejette PHI-like / URL / reason invalide / name inconnu', () => {
    expect(isImagingTelemetryEventName('patient_open')).toBe(false)
    expect(
      isImagingTelemetryEvent({
        name: 'time_to_first_paint',
        reason: 'https://signed.example/token',
      }),
    ).toBe(false)
    expect(
      isImagingTelemetryEvent({
        name: 'series_open_ms',
        reason: 'Empty Pixel Buffer!',
      }),
    ).toBe(false)
    expect(
      isImagingTelemetryEvent({
        name: 'series_open_ms',
        durationMs: Number.NaN,
      }),
    ).toBe(false)
  })

  it('detecte les messages worker asset (sans logger le message)', () => {
    expect(looksLikeWorkerAssetFailure('Failed to construct Worker')).toBe(true)
    expect(
      looksLikeWorkerAssetFailure('GET /_next/static/chunks/assets/workers/jpeg2000.worker.min.js 404'),
    ).toBe(true)
    expect(looksLikeWorkerAssetFailure('orientation mismatch')).toBe(false)
    expect(looksLikeWorkerAssetFailure(null)).toBe(false)
  })

  it('emitImagingTelemetry ignore handler absent et avale les throw', () => {
    expect(() =>
      emitImagingTelemetry(undefined, { name: 'openjpeg_fallback', engine: 'openjpeg' }),
    ).not.toThrow()

    const bad = vi.fn(() => {
      throw new Error('analytics down')
    })
    expect(() =>
      emitImagingTelemetry(bad, { name: 'openjpeg_fallback', outcome: 'fallback' }),
    ).not.toThrow()
    expect(bad).toHaveBeenCalledOnce()
  })

  it('n emit pas un événement mal forme', () => {
    const handler = vi.fn()
    emitImagingTelemetry(handler, { name: 'nope' } as unknown as ImagingTelemetryEvent)
    expect(handler).not.toHaveBeenCalled()
  })
})
