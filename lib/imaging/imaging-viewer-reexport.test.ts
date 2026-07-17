import { describe, expect, it } from 'vitest'
import * as pkg from '@franchir/imaging-viewer'
import {
  formatDicomLoadError,
  MAX_SEQUENTIAL_POOL,
  SEQUENTIAL_ORIENTATION_FALLBACK_MSG,
} from '@/components/patient/dicom-viewer/dicom-viewer-types'
import { nextPoolLoadIndex, POOL_BOOTSTRAP_INDEX } from '@/components/patient/dicom-viewer/dicom-viewer-pool-plan'
import { hasPixelSignal } from '@/lib/imaging/dicom-pixel-signal'

describe('imaging-viewer re-export shims (tracker)', () => {
  it('aligne types / policy / pool / pixel-signal sur le package', () => {
    expect(formatDicomLoadError).toBe(pkg.formatDicomLoadError)
    expect(MAX_SEQUENTIAL_POOL).toBe(pkg.MAX_SEQUENTIAL_POOL)
    expect(SEQUENTIAL_ORIENTATION_FALLBACK_MSG).toBe(pkg.SEQUENTIAL_ORIENTATION_FALLBACK_MSG)
    expect(nextPoolLoadIndex).toBe(pkg.nextPoolLoadIndex)
    expect(POOL_BOOTSTRAP_INDEX).toBe(pkg.POOL_BOOTSTRAP_INDEX)
    expect(hasPixelSignal).toBe(pkg.hasPixelSignal)
  })
})
