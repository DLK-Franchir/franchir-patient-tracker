import { describe, expect, it, vi } from 'vitest'
import {
  DICOM_EXPORT_ASYNC_REASONS,
  DICOM_EXPORT_REASONS,
  DICOM_EXPORT_SYNC_REASONS,
  IMAGING_TELEMETRY_ALERT_THRESHOLDS,
  IMAGING_TELEMETRY_ANALYTICS_PREFIX,
  IMAGING_TELEMETRY_EVENT_NAMES,
  buildImagingTelemetryContractSummary,
  emitImagingTelemetry,
  imagingTelemetryAnalyticsEventName,
  imagingTelemetryToAnalyticsProps,
  isDicomExportReason,
  isImagingTelemetryEvent,
  isImagingTelemetryEventName,
  looksLikeWorkerAssetFailure,
  type ImagingTelemetryEvent,
} from './telemetry'

describe('imaging telemetry event shapes', () => {
  it('expose les noms produit stables', () => {
    expect([...IMAGING_TELEMETRY_EVENT_NAMES].sort()).toEqual(
      [
        'dicom_export',
        'openjpeg_fallback',
        'ready_without_pixels',
        'series_open_ms',
        'time_to_first_paint',
        'worker_asset_fail',
      ].sort(),
    )
  })

  it('valide dicom_export (download) sans PHI', () => {
    expect(
      isImagingTelemetryEvent({
        name: 'dicom_export',
        durationMs: 4200,
        fileCount: 900,
        outcome: 'ready',
        reason: 'study_chunked',
      }),
    ).toBe(true)
  })

  it('expose raisons dicom_export sync + async reservees P7', () => {
    expect(DICOM_EXPORT_SYNC_REASONS).toContain('study_chunked')
    expect(DICOM_EXPORT_ASYNC_REASONS).toEqual([
      'study_async',
      'study_async_fail',
      'study_async_timeout',
    ])
    for (const reason of DICOM_EXPORT_REASONS) {
      expect(isDicomExportReason(reason)).toBe(true)
      expect(
        isImagingTelemetryEvent({
          name: 'dicom_export',
          outcome: reason.endsWith('_fail') || reason.endsWith('_timeout') ? 'error' : 'ready',
          reason,
        }),
      ).toBe(true)
    }
    expect(isDicomExportReason('patient_123')).toBe(false)
  })

  it('buildImagingTelemetryContractSummary est non-PHI et versionne', () => {
    const summary = buildImagingTelemetryContractSummary()
    expect(summary.version).toBe(1)
    expect(summary.analyticsPrefix).toBe(IMAGING_TELEMETRY_ANALYTICS_PREFIX)
    expect(summary.analyticsEventNames).toContain('imaging_ready_without_pixels')
    expect(summary.analyticsEventNames).toContain(
      imagingTelemetryAnalyticsEventName('dicom_export'),
    )
    expect(summary.dicomExportReasons.asyncReserved).toEqual([...DICOM_EXPORT_ASYNC_REASONS])
    expect(summary.alertThresholds.readyWithoutPixelsPerHour).toBe(
      IMAGING_TELEMETRY_ALERT_THRESHOLDS.readyWithoutPixelsPerHour,
    )
    expect(summary.neverInclude).toContain('signed_url')
    expect(JSON.stringify(summary)).not.toMatch(/https?:\/\//i)
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
