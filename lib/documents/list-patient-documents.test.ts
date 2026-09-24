import { describe, expect, it, vi } from 'vitest'
import {
  DOCUMENTS_LIST_PAGE_SIZE,
  MAX_DOCUMENTS_LISTED,
  SIGNED_URL_BATCH_SIZE,
} from '@/lib/documents/patient-documents'
import { fetchPatientDocumentRows } from '@/lib/documents/fetch-patient-document-rows'
import { listPatientDocuments } from '@/lib/documents/list-patient-documents'

describe('patient documents listing cap', () => {
  it('keeps a headroom above the previous 4000 cut that hid new IRM uploads', () => {
    expect(MAX_DOCUMENTS_LISTED).toBeGreaterThanOrEqual(6000)
  })

  it('pages at or below PostgREST max_rows so .limit(6000) is not silently capped', () => {
    expect(DOCUMENTS_LIST_PAGE_SIZE).toBeLessThanOrEqual(1000)
    expect(SIGNED_URL_BATCH_SIZE).toBeGreaterThan(0)
    expect(SIGNED_URL_BATCH_SIZE).toBeLessThanOrEqual(200)
  })
})

describe('fetchPatientDocumentRows', () => {
  it('pages past PostgREST max_rows until the dossier is exhausted', async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => ({
      id: `a-${i}`,
      created_at: `2026-09-24T15:${String(i % 60).padStart(2, '0')}:00Z`,
    }))
    const page2 = Array.from({ length: 1000 }, (_, i) => ({
      id: `b-${i}`,
      created_at: `2026-09-18T17:${String(i % 60).padStart(2, '0')}:00Z`,
    }))
    const page3 = Array.from({ length: 305 }, (_, i) => ({
      id: `c-${i}`,
      created_at: `2026-09-18T16:${String(i % 60).padStart(2, '0')}:00Z`,
    }))

    const rangeMock = vi
      .fn()
      .mockResolvedValueOnce({ data: page1, error: null })
      .mockResolvedValueOnce({ data: page2, error: null })
      .mockResolvedValueOnce({ data: page3, error: null })

    const orderMock = vi.fn(() => ({ range: rangeMock }))
    const eqMock = vi.fn(() => ({ order: orderMock }))
    const selectMock = vi.fn(() => ({ eq: eqMock }))
    const fromMock = vi.fn(() => ({ select: selectMock }))

    const supabase = { from: fromMock } as never

    const { rows, truncated } = await fetchPatientDocumentRows(supabase, 'patient-1', {
      select: 'id, created_at',
      pageSize: 1000,
    })

    expect(rows).toHaveLength(2305)
    expect(truncated).toBe(false)
    expect(rangeMock).toHaveBeenCalledTimes(3)
    expect(rangeMock).toHaveBeenNthCalledWith(1, 0, 999)
    expect(rangeMock).toHaveBeenNthCalledWith(2, 1000, 1999)
    expect(rangeMock).toHaveBeenNthCalledWith(3, 2000, 2999)
  })

  it('stops at MAX_DOCUMENTS_LISTED and marks truncated', async () => {
    const rangeMock = vi.fn(async (from: number, to: number) => {
      const n = to - from + 1
      return {
        data: Array.from({ length: n }, (_, i) => ({ id: `x-${from + i}` })),
        error: null,
      }
    })
    const orderMock = vi.fn(() => ({ range: rangeMock }))
    const eqMock = vi.fn(() => ({ order: orderMock }))
    const selectMock = vi.fn(() => ({ eq: eqMock }))
    const fromMock = vi.fn(() => ({ select: selectMock }))

    const { rows, truncated } = await fetchPatientDocumentRows(
      { from: fromMock } as never,
      'patient-1',
      { select: 'id', limit: 2500, pageSize: 1000 },
    )

    expect(rows).toHaveLength(2500)
    expect(truncated).toBe(true)
    expect(rangeMock).toHaveBeenCalledTimes(3)
    // Last page asks only for the remaining 500.
    expect(rangeMock).toHaveBeenNthCalledWith(3, 2000, 2499)
  })
})

describe('listPatientDocuments', () => {
  it('signs URLs in batches and does not drop later pages after ASC re-sort', async () => {
    // 150 rows → 2 sign batches with SIGNED_URL_BATCH_SIZE=100
    const records = Array.from({ length: 150 }, (_, i) => ({
      id: `id-${i}`,
      kind: 'dicom',
      file_path: `patients/p/file-${i}.dcm`,
      file_name: `file-${i}.dcm`,
      mime_type: 'application/dicom',
      size_bytes: 1000,
      created_at: `2026-09-24T${String(10 + Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00.000Z`,
      sop_instance_uid: `sop-${i}`,
      series_instance_uid: i < 100 ? 'series-old' : 'series-new-encephalo',
      modality: 'MR',
      series_description: i < 100 ? 'Ax T2 Space' : 'Sag T1 MPRAGE',
      body_part: null,
      instance_number: i,
      acquisition_datetime: null,
    }))

    const rangeMock = vi.fn().mockResolvedValue({ data: records, error: null })
    const orderMock = vi.fn(() => ({ range: rangeMock }))
    const eqMock = vi.fn(() => ({ order: orderMock }))
    const selectMock = vi.fn(() => ({ eq: eqMock }))
    const fromMock = vi.fn(() => ({ select: selectMock }))

    const createSignedUrls = vi.fn(async (paths: string[]) => ({
      data: paths.map((path) => ({
        error: null,
        path,
        signedUrl: `https://signed.example/${encodeURIComponent(path)}`,
      })),
      error: null,
    }))

    const supabase = {
      from: fromMock,
      storage: {
        from: () => ({ createSignedUrls }),
      },
    } as never

    const { documents, listingTruncated } = await listPatientDocuments(supabase, 'patient-1')

    expect(listingTruncated).toBe(false)
    expect(documents).toHaveLength(150)
    expect(createSignedUrls).toHaveBeenCalledTimes(2)
    expect(createSignedUrls.mock.calls[0][0]).toHaveLength(100)
    expect(createSignedUrls.mock.calls[1][0]).toHaveLength(50)

    const series = new Set(documents.map((d) => d.seriesInstanceUid))
    expect(series.has('series-new-encephalo')).toBe(true)
    expect(series.has('series-old')).toBe(true)
  })
})
