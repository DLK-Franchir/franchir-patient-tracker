import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createServiceRoleClient: vi.fn(),
  cleanupExpiredAsyncExports: vi.fn(),
}))

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: mocks.createServiceRoleClient,
}))

vi.mock('@/lib/imaging/dicom-export-async', async () => {
  const actual = await vi.importActual<typeof import('@/lib/imaging/dicom-export-async')>(
    '@/lib/imaging/dicom-export-async',
  )
  return {
    ...actual,
    cleanupExpiredAsyncExports: mocks.cleanupExpiredAsyncExports,
  }
})

import { GET } from './route'

describe('GET /api/internal/imaging/cleanup-async-exports', () => {
  const envBackup = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'cron-secret'
    process.env.TRACKER_SYNC_SERVICE_TOKEN = 'sync-token'
    mocks.createServiceRoleClient.mockReturnValue({})
    mocks.cleanupExpiredAsyncExports.mockResolvedValue({
      dryRun: false,
      patientPrefixesScanned: 2,
      jobsScanned: 5,
      jobsExpired: 1,
      objectsDeleted: 3,
      listErrors: 0,
      deleteErrors: 0,
      truncated: false,
    })
  })

  afterEach(() => {
    process.env = { ...envBackup }
  })

  it('returns 404 when no secrets configured', async () => {
    delete process.env.CRON_SECRET
    delete process.env.TRACKER_SYNC_SERVICE_TOKEN
    const res = await GET(
      new Request('http://localhost/api/internal/imaging/cleanup-async-exports'),
    )
    expect(res.status).toBe(404)
  })

  it('returns 401 on bad bearer', async () => {
    const res = await GET(
      new Request('http://localhost/api/internal/imaging/cleanup-async-exports', {
        headers: { Authorization: 'Bearer wrong' },
      }),
    )
    expect(res.status).toBe(401)
  })

  it('accepte CRON_SECRET et renvoie des compteurs', async () => {
    const res = await GET(
      new Request('http://localhost/api/internal/imaging/cleanup-async-exports', {
        headers: { Authorization: 'Bearer cron-secret' },
      }),
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body.jobsExpired).toBe(1)
    expect(body.objectsDeleted).toBe(3)
    expect(body).not.toHaveProperty('patientId')
    expect(mocks.cleanupExpiredAsyncExports).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ dryRun: false }),
    )
  })

  it('accepte TRACKER_SYNC_SERVICE_TOKEN et dryRun', async () => {
    const res = await GET(
      new Request(
        'http://localhost/api/internal/imaging/cleanup-async-exports?dryRun=1&maxJobs=10',
        {
          headers: { Authorization: 'Bearer sync-token' },
        },
      ),
    )
    expect(res.status).toBe(200)
    expect(mocks.cleanupExpiredAsyncExports).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ dryRun: true, maxJobs: 10 }),
    )
  })
})
