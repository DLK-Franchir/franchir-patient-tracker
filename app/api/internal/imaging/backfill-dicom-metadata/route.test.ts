import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createServiceRoleClient: vi.fn(),
  backfillPatientDicomMetadata: vi.fn(),
}))

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: mocks.createServiceRoleClient,
}))

vi.mock('@/lib/imaging/backfill-dicom-metadata', async () => {
  const actual = await vi.importActual<typeof import('@/lib/imaging/backfill-dicom-metadata')>(
    '@/lib/imaging/backfill-dicom-metadata',
  )
  return {
    ...actual,
    backfillPatientDicomMetadata: mocks.backfillPatientDicomMetadata,
  }
})

import { POST } from './route'

describe('POST /api/internal/imaging/backfill-dicom-metadata', () => {
  const envBackup = { ...process.env }
  const patientId = '22222222-2222-2222-2222-222222222222'

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TRACKER_SYNC_SERVICE_TOKEN = 'sync-token'
    mocks.createServiceRoleClient.mockReturnValue({})
    mocks.backfillPatientDicomMetadata.mockResolvedValue({
      patientId,
      dryRun: true,
      scanned: 3,
      parseOk: 3,
      parseFailed: 0,
      updated: 3,
      skipped: 0,
    })
  })

  afterEach(() => {
    process.env = { ...envBackup }
  })

  it('returns 404 when sync token missing', async () => {
    delete process.env.TRACKER_SYNC_SERVICE_TOKEN
    const res = await POST(
      new Request('http://localhost/api/internal/imaging/backfill-dicom-metadata', {
        method: 'POST',
        body: JSON.stringify({ patientId, dryRun: true }),
      }),
    )
    expect(res.status).toBe(404)
  })

  it('returns 401 on bad bearer', async () => {
    const res = await POST(
      new Request('http://localhost/api/internal/imaging/backfill-dicom-metadata', {
        method: 'POST',
        headers: { Authorization: 'Bearer wrong' },
        body: JSON.stringify({ patientId, dryRun: true }),
      }),
    )
    expect(res.status).toBe(401)
  })

  it('returns counters on success', async () => {
    const res = await POST(
      new Request('http://localhost/api/internal/imaging/backfill-dicom-metadata', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer sync-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ patientId, dryRun: true }),
      }),
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.scanned).toBe(3)
    expect(body.updated).toBe(3)
    expect(mocks.backfillPatientDicomMetadata).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ patientId, dryRun: true }),
    )
  })
})
