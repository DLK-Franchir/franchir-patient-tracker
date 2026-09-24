import { describe, expect, it } from 'vitest'
import {
  DEFAULT_VIEWER_CAPABILITIES,
  SEQUENTIAL_LOCALIZER_ORIENTATION_MSG,
  SEQUENTIAL_ORIENTATION_FALLBACK_MSG,
  VIEWER_INFORMATIVE_NOTICE,
  WHEEL_NOTCH_PX,
  WHEEL_SLICE_STEP_PX,
  WL_PRESETS,
  accumulateWheelSlices,
  formatDicomLoadError,
  formatSeriesOverlayLabel,
  formatWindowLevelOverlay,
  isStackOrientationMismatch,
  isJpeg2000LoadFailure,
  isUnsupportedJpeg2000Error,
  jpeg2000UidInBytes,
  loadErrorMessage,
  normalizeModality,
  orientationFallbackMessage,
  resolveViewerCapabilities,
  resolveViewerInfoKind,
  windowPresetsForModality,
} from './policy'

describe('windowPresetsForModality (U0)', () => {
  it('propose les presets HU pour le scanner uniquement', () => {
    expect(windowPresetsForModality('CT')).toEqual(WL_PRESETS)
    expect(windowPresetsForModality(' ct ')).toEqual(WL_PRESETS)
  })

  it('masque les presets HU sur IRM, radio et modality inconnue', () => {
    expect(windowPresetsForModality('MR')).toEqual([])
    expect(windowPresetsForModality('DX')).toEqual([])
    expect(windowPresetsForModality(null)).toEqual([])
    expect(windowPresetsForModality('')).toEqual([])
  })

  it('normalise la modality', () => {
    expect(normalizeModality(' mr ')).toBe('MR')
    expect(normalizeModality('')).toBeNull()
    expect(normalizeModality(undefined)).toBeNull()
  })
})

describe('accumulateWheelSlices (U0)', () => {
  it('ne bouge pas sous le seuil et conserve le reste (trackpad)', () => {
    expect(accumulateWheelSlices(0, 10)).toEqual({ steps: 0, remainder: 10 })
    expect(accumulateWheelSlices(7, 0)).toEqual({ steps: 0, remainder: 7 })
  })

  it('avance d une coupe par pas de seuil, signe conservé', () => {
    expect(accumulateWheelSlices(0, WHEEL_SLICE_STEP_PX)).toEqual({ steps: 1, remainder: 0 })
    expect(accumulateWheelSlices(0, -(WHEEL_SLICE_STEP_PX + 5))).toEqual({
      steps: -1,
      remainder: -5,
    })
  })

  it('un cran souris (Chrome deltaY≈100) = exactement une coupe', () => {
    expect(accumulateWheelSlices(0, 100)).toEqual({ steps: 1, remainder: 0 })
    expect(accumulateWheelSlices(15, -120)).toEqual({ steps: -1, remainder: 0 })
    expect(accumulateWheelSlices(0, WHEEL_NOTCH_PX)).toEqual({ steps: 1, remainder: 0 })
  })

  it('deltaMode ligne / page (Firefox) = une coupe par événement', () => {
    expect(accumulateWheelSlices(0, 3, 1)).toEqual({ steps: 1, remainder: 0 })
    expect(accumulateWheelSlices(0, -3, 1)).toEqual({ steps: -1, remainder: 0 })
    expect(accumulateWheelSlices(0, 1, 2)).toEqual({ steps: 1, remainder: 0 })
  })

  it('cumule les petits deltas trackpad', () => {
    let acc = 0
    let total = 0
    for (let i = 0; i < 6; i += 1) {
      const r = accumulateWheelSlices(acc, 5)
      acc = r.remainder
      total += r.steps
    }
    expect(total).toBe(1)
    expect(acc).toBe(6)
  })
})

describe('overlay formatters (U0)', () => {
  it('formate le W/L arrondi', () => {
    expect(formatWindowLevelOverlay({ center: 39.6, width: 400.2 })).toBe('F 400 / C 40')
    expect(formatWindowLevelOverlay(null)).toBeNull()
    expect(formatWindowLevelOverlay({ center: Number.NaN, width: 1 })).toBeNull()
  })

  it('compose modality et description', () => {
    expect(formatSeriesOverlayLabel({ modality: 'mr', description: 'SAG T2' })).toBe('MR · SAG T2')
    expect(formatSeriesOverlayLabel({ modality: 'CT' })).toBe('CT')
    expect(formatSeriesOverlayLabel({ description: ' AX T1 ' })).toBe('AX T1')
    expect(formatSeriesOverlayLabel({})).toBeNull()
  })

  it('expose la mention informatif / non diagnostique', () => {
    expect(VIEWER_INFORMATIVE_NOTICE).toMatch(/informatif/)
    expect(VIEWER_INFORMATIVE_NOTICE).toMatch(/diagnostique/)
  })
})

describe('isStackOrientationMismatch', () => {
  it('détecte le message dwv standard', () => {
    expect(isStackOrientationMismatch('Cannot append a slice with different orientation')).toBe(
      true
    )
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
        'Uncaught Error: JPX Error: Unsupported COD options (selectiveArithmeticCodingBypass)'
      )
    ).toBe(true)
  })

  it('détecte les variantes de message', () => {
    expect(isUnsupportedJpeg2000Error('JPX Error: something')).toBe(true)
    expect(isUnsupportedJpeg2000Error('Unsupported COD options (foo)')).toBe(true)
    expect(isUnsupportedJpeg2000Error('selectiveArithmeticCodingBypass')).toBe(true)
  })

  it('ignore les messages sans rapport', () => {
    expect(isUnsupportedJpeg2000Error('Cannot append a slice with different orientation')).toBe(
      false
    )
    expect(isUnsupportedJpeg2000Error('codec not supported')).toBe(false)
    expect(isUnsupportedJpeg2000Error(null)).toBe(false)
  })
})

describe('repli JPEG 2000 Cornerstone', () => {
  it('déplie un rejet { error } du loader wadouri', () => {
    expect(loadErrorMessage({ error: new Error('JPX Error: decode') })).toBe('JPX Error: decode')
    expect(loadErrorMessage(new Error('direct'))).toBe('direct')
    expect(loadErrorMessage({ error: { message: 'nested' } })).toBe('nested')
  })

  it('reconnaît une radio JPEG 2000 même si le message est opaque', () => {
    expect(isJpeg2000LoadFailure({ transferSyntax: '1.2.840.10008.1.2.4.90' })).toBe(true)
    expect(isJpeg2000LoadFailure({ message: 'JPX Error: Unsupported COD options' })).toBe(true)
    expect(isJpeg2000LoadFailure({ message: 'orientation mismatch' })).toBe(false)
    const header = new TextEncoder().encode('DICM....1.2.840.10008.1.2.4.91....')
    expect(jpeg2000UidInBytes(header)).toBe('1.2.840.10008.1.2.4.91')
    expect(jpeg2000UidInBytes(new TextEncoder().encode('1.2.840.10008.1.2.1'))).toBeNull()
  })
})

describe('formatDicomLoadError', () => {
  it('signale un JWT Supabase Storage expiré', () => {
    expect(
      formatDicomLoadError(
        '{"statusCode":"400","error":"InvalidJWT","message":"\\"exp\\" claim timestamp check failed"}'
      )
    ).toBe('Lien imagerie expiré — fermez la visionneuse et rouvrez la série')
  })

  it('conserve le message dwv pour les autres erreurs', () => {
    expect(formatDicomLoadError('orientation mismatch')).toBe('orientation mismatch')
  })
})

describe('orientationFallbackMessage', () => {
  it('explique le multi-plans pour un localizer', () => {
    expect(orientationFallbackMessage('localizer (8 images)')).toBe(
      SEQUENTIAL_LOCALIZER_ORIENTATION_MSG
    )
    expect(SEQUENTIAL_LOCALIZER_ORIENTATION_MSG).toMatch(/AX\/SAG\/COR/)
  })

  it('garde le message générique pour les autres séries', () => {
    expect(orientationFallbackMessage('SAG T1 (19 images)')).toBe(
      SEQUENTIAL_ORIENTATION_FALLBACK_MSG
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
      })
    ).toBe('sequential')
    expect(
      resolveViewerInfoKind({
        isBusy: false,
        status: 'ready',
        navMode: 'stack',
        fileCount: 19,
        sliceCount: 19,
      })
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
