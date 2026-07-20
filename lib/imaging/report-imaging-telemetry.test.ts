import { afterEach, describe, expect, it, vi } from 'vitest'
import { reportImagingTelemetry } from './report-imaging-telemetry'

describe('reportImagingTelemetry (tracker adapter)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('envoie des props scalaires sans URL vers gtag / plausible', () => {
    const gtag = vi.fn()
    const plausible = vi.fn()
    vi.stubGlobal('window', { gtag, plausible })

    reportImagingTelemetry({
      name: 'time_to_first_paint',
      durationMs: 420.4,
      navMode: 'stack',
      fileCount: 3,
      engine: 'dwv',
      outcome: 'ready',
    })

    expect(gtag).toHaveBeenCalledWith(
      'event',
      'imaging_time_to_first_paint',
      expect.objectContaining({
        name: 'time_to_first_paint',
        duration_ms: 420,
        nav_mode: 'stack',
        file_count: 3,
        engine: 'dwv',
        outcome: 'ready',
      }),
    )
    expect(plausible).toHaveBeenCalledWith(
      'imaging_time_to_first_paint',
      expect.objectContaining({
        props: expect.objectContaining({ duration_ms: 420 }),
      }),
    )
  })
})
