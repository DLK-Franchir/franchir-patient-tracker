import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { inferRenderType } from '@/lib/documents/patient-documents'

describe('inferRenderType (MP4 staging)', () => {
  const original = process.env.NEXT_PUBLIC_ENABLE_MP4_VIEWER

  afterEach(() => {
    if (original === undefined) {
      delete process.env.NEXT_PUBLIC_ENABLE_MP4_VIEWER
    } else {
      process.env.NEXT_PUBLIC_ENABLE_MP4_VIEWER = original
    }
  })

  it('classifie MP4 en video quand le flag staging est actif', () => {
    process.env.NEXT_PUBLIC_ENABLE_MP4_VIEWER = 'true'
    expect(inferRenderType('consultation.mp4', 'video/mp4')).toBe('video')
    expect(inferRenderType('clip.m4v')).toBe('video')
  })

  it('laisse MP4 en other quand le flag est inactif', () => {
    delete process.env.NEXT_PUBLIC_ENABLE_MP4_VIEWER
    expect(inferRenderType('consultation.mp4', 'video/mp4')).toBe('other')
  })
})
