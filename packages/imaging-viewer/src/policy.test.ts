import { describe, expect, it } from 'vitest'
import {
  DEFAULT_VIEWER_CAPABILITIES,
  SEQUENTIAL_LOCALIZER_ORIENTATION_MSG,
  SEQUENTIAL_ORIENTATION_FALLBACK_MSG,
  formatDicomLoadError,
  isStackOrientationMismatch,
  isUnsupportedJpeg2000Error,
  orientationFallbackMessage,
  resolveViewerCapabilities,
  resolveViewerInfoKind,
} from './policy'

describe('isStackOrientationMismatch', () => {
  it('détecte le message dwv standard', () => {
    expect(
      isStackOrientationMismatch('Cannot append a slice with different orientation'),
    ).toBe(true)
  })

  it('ignore les messages sans rapport', () => {
    expect(isStackOrientationMismatch('codec not supported')).toBe(false)
    expect(isStackOrientationMismatch(null)).toBe(false)
  })

  it('expose le message utilisateur de repli séquentiel', () => {
    expect(SEQUENTIAL_ORIENTATION_FALLBACK_MSG).toMatch(/Orientations d'images incompatibles/)
  })
})

describe('isUnsupportedJpeg2000Error', () => {
  it('détecte l erreur JPX réelle des radios DX Husain', () => {
    expect(
      isUnsupportedJpeg2000Error(
        'Uncaught Error: JPX Error: Unsupported COD options (selectiveArithmeticCodingBypass)',
      ),
    ).toBe(true)
  })

  it('détecte les variantes de message', () => {
    expect(isUnsupportedJpeg2000Error('JPX Error: something')).toBe(true)
    expect(isUnsupportedJpeg2000Error('Unsupported COD options (foo)')).toBe(true)
    expect(isUnsupportedJpeg2000Error('selectiveArithmeticCodingBypass')).toBe(true)
  })

  it('ignore les messages sans rapport', () => {
    expect(isUnsupportedJpeg2000Error('Cannot append a slice with different orientation')).toBe(
      false,
    )
    expect(isUnsupportedJpeg2000Error('codec not supported')).toBe(false)
    expect(isUnsupportedJpeg2000Error(null)).toBe(false)
  })
})

describe('formatDicomLoadError', () => {
  it('signale un JWT Supabase Storage expiré', () => {
    expect(
      formatDicomLoadError(
        '{"statusCode":"400","error":"InvalidJWT","message":"\\"exp\\" claim timestamp check failed"}',
      ),
    ).toBe('Lien imagerie expiré — fermez la visionneuse et rouvrez la série')
  })

  it('conserve le message dwv pour les autres erreurs', () => {
    expect(formatDicomLoadError('orientation mismatch')).toBe('orientation mismatch')
  })
})

describe('orientationFallbackMessage', () => {
  it('explique le multi-plans pour un localizer', () => {
    expect(orientationFallbackMessage('localizer (8 images)')).toBe(
      SEQUENTIAL_LOCALIZER_ORIENTATION_MSG,
    )
    expect(SEQUENTIAL_LOCALIZER_ORIENTATION_MSG).toMatch(/AX\/SAG\/COR/)
  })

  it('garde le message générique pour les autres séries', () => {
    expect(orientationFallbackMessage('SAG T1 (19 images)')).toBe(
      SEQUENTIAL_ORIENTATION_FALLBACK_MSG,
    )
  })
})

describe('resolveViewerInfoKind', () => {
  it('distingue sequential vs stack', () => {
    expect(
      resolveViewerInfoKind({
        isBusy: false,
        status: 'ready',
        navMode: 'sequential',
        fileCount: 8,
        sliceCount: 1,
      }),
    ).toBe('sequential')
    expect(
      resolveViewerInfoKind({
        isBusy: false,
        status: 'ready',
        navMode: 'stack',
        fileCount: 19,
        sliceCount: 19,
      }),
    ).toBe('stack')
  })
})

describe('resolveViewerCapabilities', () => {
  it('retourne une copie des defaults sans override', () => {
    const caps = resolveViewerCapabilities()
    expect(caps).toEqual(DEFAULT_VIEWER_CAPABILITIES)
    expect(caps).not.toBe(DEFAULT_VIEWER_CAPABILITIES)
  })

  it('preserve les flags openjpeg / pdf / mp4 documentés', () => {
    expect(DEFAULT_VIEWER_CAPABILITIES.jpeg2000OpenJpegFallback).toBe(true)
    expect(DEFAULT_VIEWER_CAPABILITIES.encapsulatedPdf).toBe(true)
    expect(DEFAULT_VIEWER_CAPABILITIES.mp4Native).toBe(false)
    expect(resolveViewerCapabilities({ mp4Native: true }).mp4Native).toBe(true)
  })
})
