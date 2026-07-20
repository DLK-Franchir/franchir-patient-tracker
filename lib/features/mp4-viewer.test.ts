import { afterEach, describe, expect, it, vi } from 'vitest'

describe('inferRenderType (MP4 flag)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('classifie MP4/m4v en video quand ENABLE_MP4_VIEWER=true', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_MP4_VIEWER', 'true')
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', 'production')
    vi.stubEnv('NODE_ENV', 'production')
    const { inferRenderType } = await import('@/lib/documents/patient-documents')
    expect(inferRenderType('consultation.mp4', 'video/mp4')).toBe('video')
    expect(inferRenderType('clip.m4v')).toBe('video')
  })

  it('honore alias NEXT_PUBLIC_MP4_VIEWER=1', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_MP4_VIEWER', '')
    vi.stubEnv('NEXT_PUBLIC_MP4_VIEWER', '1')
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', 'production')
    vi.stubEnv('NODE_ENV', 'production')
    const { isMp4ViewerEnabled } = await import('./mp4-viewer')
    expect(isMp4ViewerEnabled()).toBe(true)
    const { inferRenderType } = await import('@/lib/documents/patient-documents')
    expect(inferRenderType('clip.m4v')).toBe('video')
  })

  it('active MP4 sur preview Vercel sans variable explicite', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_MP4_VIEWER', '')
    vi.stubEnv('NEXT_PUBLIC_MP4_VIEWER', '')
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', 'preview')
    const { inferRenderType } = await import('@/lib/documents/patient-documents')
    expect(inferRenderType('consultation.m4v')).toBe('video')
  })

  it('laisse MP4 en other en production sans flag explicite', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_MP4_VIEWER', '')
    vi.stubEnv('NEXT_PUBLIC_MP4_VIEWER', '')
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', 'production')
    vi.stubEnv('NODE_ENV', 'production')
    const { isMp4ViewerEnabled } = await import('./mp4-viewer')
    expect(isMp4ViewerEnabled()).toBe(false)
    const { inferRenderType } = await import('@/lib/documents/patient-documents')
    expect(inferRenderType('consultation.mp4', 'video/mp4')).toBe('other')
  })
})

describe('mp4SourceMimeType', () => {
  it('mappe m4v vers video/x-m4v', async () => {
    const { mp4SourceMimeType } = await import('./mp4-viewer')
    expect(mp4SourceMimeType('clip.m4v')).toBe('video/x-m4v')
    expect(mp4SourceMimeType('https://x/y/clip.m4v?token=1')).toBe('video/x-m4v')
    expect(mp4SourceMimeType('consultation.mp4')).toBe('video/mp4')
  })
})
