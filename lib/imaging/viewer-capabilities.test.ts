import { afterEach, describe, expect, it, vi } from 'vitest'

describe('getAppViewerCapabilities', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('mp4Native false par defaut (prod-like)', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_MP4_VIEWER', '')
    vi.stubEnv('NEXT_PUBLIC_MP4_VIEWER', '')
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', 'production')
    vi.stubEnv('NODE_ENV', 'production')
    const { getAppViewerCapabilities } = await import('./viewer-capabilities')
    const caps = getAppViewerCapabilities()
    expect(caps.mp4Native).toBe(false)
    expect(caps.jpeg2000OpenJpegFallback).toBe(true)
    expect(caps.encapsulatedPdf).toBe(true)
    expect(caps.pixelSignalGate).toBe(true)
  })

  it('mp4Native true quand le flag staging est pose', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_MP4_VIEWER', 'true')
    const { getAppViewerCapabilities } = await import('./viewer-capabilities')
    expect(getAppViewerCapabilities().mp4Native).toBe(true)
  })

  it('mp4Native true avec alias NEXT_PUBLIC_MP4_VIEWER=1', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_MP4_VIEWER', '')
    vi.stubEnv('NEXT_PUBLIC_MP4_VIEWER', '1')
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', 'production')
    vi.stubEnv('NODE_ENV', 'production')
    const { getAppViewerCapabilities } = await import('./viewer-capabilities')
    expect(getAppViewerCapabilities().mp4Native).toBe(true)
  })
})
