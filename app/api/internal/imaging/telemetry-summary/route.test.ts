import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GET } from './route'

describe('imaging telemetry-summary route', () => {
  const envBackup = { ...process.env }

  beforeEach(() => {
    process.env.TRACKER_SYNC_SERVICE_TOKEN = 'sync-token'
    process.env.TRACKER_RETURN_TOKEN = 'return-token'
    process.env.NEXT_PUBLIC_GA_ID = 'G-TEST'
    delete process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN
    delete process.env.NEXT_PUBLIC_PLAUSIBLE_HOST
  })

  afterEach(() => {
    process.env = { ...envBackup }
  })

  it('returns 404 when no bridge tokens configured', async () => {
    delete process.env.TRACKER_SYNC_SERVICE_TOKEN
    delete process.env.TRACKER_RETURN_TOKEN

    const response = await GET(new Request('http://localhost/api/internal/imaging/telemetry-summary'))
    expect(response.status).toBe(404)
  })

  it('returns 401 on bad bearer', async () => {
    const response = await GET(
      new Request('http://localhost/api/internal/imaging/telemetry-summary', {
        headers: { Authorization: 'Bearer wrong' },
      }),
    )
    expect(response.status).toBe(401)
  })

  it('returns non-PHI contract + thresholds', async () => {
    const response = await GET(
      new Request('http://localhost/api/internal/imaging/telemetry-summary', {
        headers: { Authorization: 'Bearer sync-token' },
      }),
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.status).toBe('ok')
    expect(payload.contract.version).toBe(1)
    expect(payload.contract.analyticsEventNames).toContain('imaging_dicom_export')
    expect(payload.contract.dicomExportReasons.asyncReserved).toEqual([
      'study_async',
      'study_async_fail',
      'study_async_timeout',
    ])
    expect(payload.contract.alertThresholds.readyWithoutPixelsPerHour).toBe(5)
    expect(payload.analytics.gaConfigured).toBe(true)
    expect(payload.analytics.forwarderConfigured).toBe(true)
    expect(payload.contract.neverInclude).toContain('signed_url')
    expect(JSON.stringify(payload)).not.toMatch(/https?:\/\/[^\s"]+/i)
    expect(JSON.stringify(payload)).not.toMatch(/@|Bearer |eyJ/)
  })

  it('accepts return token', async () => {
    const response = await GET(
      new Request('http://localhost/api/internal/imaging/telemetry-summary', {
        headers: { Authorization: 'Bearer return-token' },
      }),
    )
    expect(response.status).toBe(200)
  })
})
