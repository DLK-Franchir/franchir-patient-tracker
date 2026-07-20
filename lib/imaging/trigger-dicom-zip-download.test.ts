import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  downloadDicomZip,
  downloadStudyDicomExport,
  downloadStudyDicomExportAsync,
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
            recommendAsync: false,
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

  it('utilise le job async Storage quand recommendAsync', async () => {
    vi.useFakeTimers()
    const blob = new Blob(['zip'], { type: 'application/zip' })
    const jobId = '11111111-1111-4111-8111-111111111111'
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
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
            recommendAsync: true,
            asyncPartCount: 5,
            parts: [],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      if (url.endsWith('/export-async') && init?.method === 'POST') {
        return new Response(
          JSON.stringify({
            jobId,
            status: 'queued',
            partCount: 2,
            completedParts: 0,
            fileCount: 500,
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        )
      }
      if (url.includes('/build') && init?.method === 'POST') {
        return new Response(
          JSON.stringify({
            jobId,
            status: 'building',
            partCount: 2,
            completedParts: 1,
            fileCount: 500,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      if (url.includes(`/export-async/${jobId}`) && !url.includes('/build')) {
        return new Response(
          JSON.stringify({
            jobId,
            status: 'ready',
            partCount: 2,
            completedParts: 2,
            fileCount: 500,
            downloads: [
              {
                index: 0,
                filename: 'etude-dicom-part1of2.zip',
                signedUrl: 'https://storage.example/p1.zip',
              },
              {
                index: 1,
                filename: 'etude-dicom-part2of2.zip',
                signedUrl: 'https://storage.example/p2.zip',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      if (url.includes('storage.example')) {
        return new Response(blob, { status: 200 })
      }
      return new Response(JSON.stringify({ error: 'unexpected' }), { status: 500 })
    })
    vi.stubGlobal('fetch', fetchMock)
    stubBrowserDownload()

    const telemetry = vi.fn()
    const pending = downloadStudyDicomExport({
      planUrl: '/api/patients/x/imaging/study/export-plan',
      studyZipUrl: () => '/api/patients/x/imaging/study/export.zip',
      asyncUrls: {
        createUrl: '/api/patients/x/imaging/study/export-async',
        statusUrl: (id) => `/api/patients/x/imaging/study/export-async/${id}`,
        buildUrl: (id, part) =>
          `/api/patients/x/imaging/study/export-async/${id}/build?part=${part}`,
      },
      onTelemetry: telemetry,
    })
    await vi.runAllTimersAsync()
    const result = await pending
    expect(result).toEqual({ ok: true, mode: 'async', partCount: 2 })
    expect(telemetry).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'dicom_export', reason: 'study_async', outcome: 'ready' }),
    )
  })
})

describe('downloadStudyDicomExportAsync', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('emet study_async_fail si create echoue', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })),
    )
    const telemetry = vi.fn()
    const result = await downloadStudyDicomExportAsync({
      urls: {
        createUrl: '/api/patients/x/imaging/study/export-async',
        statusUrl: (id) => `/j/${id}`,
        buildUrl: (id, p) => `/j/${id}/build?part=${p}`,
      },
      onTelemetry: telemetry,
    })
    expect(result.ok).toBe(false)
    expect(telemetry).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'study_async_fail', outcome: 'error' }),
    )
  })

  it('mappe 410 expired vers message TTL 2 h', async () => {
    const jobId = '11111111-1111-4111-8111-111111111111'
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url.endsWith('/export-async') && init?.method === 'POST') {
          return new Response(
            JSON.stringify({
              jobId,
              status: 'queued',
              partCount: 1,
              completedParts: 0,
              fileCount: 2,
            }),
            { status: 200 },
          )
        }
        if (url.includes('/build')) {
          return new Response(JSON.stringify({ error: 'expired' }), { status: 410 })
        }
        return new Response('{}', { status: 404 })
      }),
    )
    const result = await downloadStudyDicomExportAsync({
      urls: {
        createUrl: '/api/patients/x/imaging/study/export-async',
        statusUrl: (id) => `/api/patients/x/imaging/study/export-async/${id}`,
        buildUrl: (id, part) =>
          `/api/patients/x/imaging/study/export-async/${id}/build?part=${part}`,
      },
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.status).toBe(410)
    expect(result.message).toMatch(/2 h/)
  })
})
