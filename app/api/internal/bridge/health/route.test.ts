import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createServiceRoleClient: vi.fn(),
}))

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: mocks.createServiceRoleClient,
}))

import { GET } from './route'

function stubStuckCount(count: number | null, error: { message: string } | null = null) {
  mocks.createServiceRoleClient.mockReturnValue({
    from: () => ({
      select: () => ({
        eq: () => ({
          lt: async () => ({ count, error }),
        }),
      }),
    }),
  })
}

describe('tracker bridge health route', () => {
  const envBackup = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TRACKER_SYNC_SERVICE_TOKEN = 'sync-token'
    process.env.TRACKER_RETURN_TOKEN = 'return-token'
    process.env.QUESTIONNAIRES_API_BASE = 'https://questionnaire.example/api/integrations/tracker'
    stubStuckCount(0)
  })

  afterEach(() => {
    process.env = { ...envBackup }
  })

  it('returns 404 when no bridge tokens configured', async () => {
    delete process.env.TRACKER_SYNC_SERVICE_TOKEN
    delete process.env.TRACKER_RETURN_TOKEN

    const response = await GET(new Request('http://localhost/api/internal/bridge/health'))
    expect(response.status).toBe(404)
  })

  it('returns 401 on bad bearer', async () => {
    const response = await GET(
      new Request('http://localhost/api/internal/bridge/health', {
        headers: { Authorization: 'Bearer wrong' },
      }),
    )
    expect(response.status).toBe(401)
  })

  it('returns healthy with shared contract keys', async () => {
    const response = await GET(
      new Request('http://localhost/api/internal/bridge/health', {
        headers: { Authorization: 'Bearer sync-token' },
      }),
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.status).toBe('healthy')
    expect(payload.bridge.syncConfigured).toBe(true)
    expect(payload.bridge.callbackConfigured).toBe(true)
    expect(payload.bridge.returnConfigured).toBe(true)
    expect(payload.stuckSent.count).toBe(0)
    expect(payload.stuckSent.queryFailed).toBe(false)
  })

  it('returns unconfigured when api base missing', async () => {
    delete process.env.QUESTIONNAIRES_API_BASE
    delete process.env.QUESTIONNAIRES_PORTAL_URL

    const response = await GET(
      new Request('http://localhost/api/internal/bridge/health', {
        headers: { Authorization: 'Bearer return-token' },
      }),
    )
    const payload = await response.json()
    expect(payload.status).toBe('unconfigured')
  })

  it('returns degraded when stuck-sent count > 0', async () => {
    stubStuckCount(3)

    const response = await GET(
      new Request('http://localhost/api/internal/bridge/health', {
        headers: { Authorization: 'Bearer sync-token' },
      }),
    )
    const payload = await response.json()
    expect(payload.status).toBe('degraded')
    expect(payload.stuckSent.count).toBe(3)
    expect(payload.stuckSent.clock).toBe('questionnaire_sent_at')
  })

  it('returns degraded when stuck query fails', async () => {
    stubStuckCount(null, { message: 'column missing' })

    const response = await GET(
      new Request('http://localhost/api/internal/bridge/health', {
        headers: { Authorization: 'Bearer sync-token' },
      }),
    )
    const payload = await response.json()
    expect(payload.status).toBe('degraded')
    expect(payload.stuckSent.queryFailed).toBe(true)
    expect(payload.stuckSent).not.toHaveProperty('error')
  })
})
