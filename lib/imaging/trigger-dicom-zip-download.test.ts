import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  downloadDicomZip,
  downloadStudyDicomExport,
} from './trigger-dicom-zip-download'

describe('downloadDicomZip', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('signale 413 study_too_large avec message UX', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            error: 'study_too_large',
            message: 'Étude trop volumineuse pour un export sync.',
            hint: 'chunked_export',
          }),
          { status: 413, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )
    const result = await downloadDicomZip('/api/patients/x/imaging/study/export.zip')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(413)
      expect(result.message).toMatch(/volumineuse/i)
      expect(result.hint).toBe('chunked_export')
    }
  })

  it('signale erreur HTTP non-413', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
    const result = await downloadDicomZip('/api/patients/x/imaging/series/s1/export.zip')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(403)
      expect(result.message).toMatch(/Forbidden|Échec/i)
    }
  })
})

describe('downloadStudyDicomExport', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  function stubBrowserDownload() {
    const click = vi.fn()
    const anchor = { click, style: {} as CSSStyleDeclaration, remove: vi.fn(), rel: '', download: '', href: '' }
    vi.stubGlobal('document', {
      createElement: vi.fn(() => anchor),
      body: { appendChild: vi.fn((n: unknown) => n) },
    })
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:test'),
      revokeObjectURL: vi.fn(),
    })
    return click
  }

  it('telecharge un ZIP unique en mode single', async () => {
    const blob = new Blob(['zip'], { type: 'application/zip' })
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('export-plan')) {
        return new Response(
          JSON.stringify({
            mode: 'single',
            fileCount: 10,
            seriesCount: 2,
            totalBytes: 1000,
            partCount: 1,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return new Response(blob, {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': 'attachment; filename="etude-dicom.zip"',
        },
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    stubBrowserDownload()

    const telemetry = vi.fn()
    const result = await downloadStudyDicomExport({
      planUrl: '/api/patients/x/imaging/study/export-plan',
      studyZipUrl: () => '/api/patients/x/imaging/study/export.zip',
      onTelemetry: telemetry,
    })
    expect(result).toEqual({ ok: true, mode: 'single', partCount: 1 })
    expect(telemetry).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'dicom_export', reason: 'study_single', outcome: 'ready' }),
    )
  })

  it('enchaine les parties en mode chunked', async () => {
    vi.useFakeTimers()
    const blob = new Blob(['zip'], { type: 'application/zip' })
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('export-plan')) {
        return new Response(
          JSON.stringify({
            mode: 'chunked',
            fileCount: 500,
            seriesCount: 5,
            totalBytes: 9_000_000,
            partCount: 2,
            maxFiles: 400,
            parts: [
              { index: 0, fileCount: 300, seriesCount: 3, totalBytes: 5_000_000 },
              { index: 1, fileCount: 200, seriesCount: 2, totalBytes: 4_000_000 },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return new Response(blob, {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': 'attachment; filename="etude-dicom-part.zip"',
        },
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    stubBrowserDownload()

    const progress: Array<{ completed: number; total: number }> = []
    const telemetry = vi.fn()
    const pending = downloadStudyDicomExport({
      planUrl: '/api/patients/x/imaging/study/export-plan',
      studyZipUrl: (part) => `/api/patients/x/imaging/study/export.zip?part=${part ?? 0}`,
      onProgress: (p) => progress.push({ completed: p.completed, total: p.total }),
      onTelemetry: telemetry,
    })
    await vi.runAllTimersAsync()
    const result = await pending
    expect(result).toEqual({ ok: true, mode: 'chunked', partCount: 2 })
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('part=0'))).toBe(true)
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('part=1'))).toBe(true)
    expect(progress.at(-1)).toEqual({ completed: 2, total: 2 })
    expect(telemetry).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'dicom_export', reason: 'study_chunked', outcome: 'ready' }),
    )
  })
})
