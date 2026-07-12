import { describe, expect, it, afterEach } from 'vitest'
import { inferRenderType } from '@/lib/documents/patient-documents'

describe('inferRenderType (MP4 staging)', () => {
  const original = process.env.NEXT_PUBLIC_ENABLE_MP4_VIEWER

  afterEach(() => {
    if (original === undefined) {
      delete process.env.NEXT_PUBLIC_ENABLE_MP4_VIEWER
    } else {
      process.env.NEXT_PUBLIC_ENABLE_MP4_VIEWER = original
    }
    delete process.env.NEXT_PUBLIC_VERCEL_ENV
  })

  it('classifie MP4 en video quand le flag staging est actif', () => {
    process.env.NEXT_PUBLIC_ENABLE_MP4_VIEWER = 'true'
    expect(inferRenderType('consultation.mp4', 'video/mp4')).toBe('video')
    expect(inferRenderType('clip.m4v')).toBe('video')
  })

  it('active MP4 sur preview Vercel sans variable explicite', () => {
    delete process.env.NEXT_PUBLIC_ENABLE_MP4_VIEWER
    process.env.NEXT_PUBLIC_VERCEL_ENV = 'preview'
    expect(inferRenderType('consultation.m4v')).toBe('video')
  })

  it('laisse MP4 en other en production sans flag explicite', () => {
    delete process.env.NEXT_PUBLIC_ENABLE_MP4_VIEWER
    process.env.NEXT_PUBLIC_VERCEL_ENV = 'production'
    expect(inferRenderType('consultation.mp4', 'video/mp4')).toBe('other')
  })
})
