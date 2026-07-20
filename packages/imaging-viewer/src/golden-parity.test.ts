/**
 * Golden parity Tania / Fatima — contrat viewer + policy (sans PHI).
 * Les fixtures listing vivent aussi dans `@franchir/imaging` ; ici on vérifie
 * le mapping série → ImagingSeries et les règles pool / orientation.
 */
import { describe, expect, it } from 'vitest'
import {
  dicomSeriesLabel,
  groupDicomFilesByMetadata,
  groupDicomFilesIntoSeries,
  type MetaImagingFile,
} from '@franchir/imaging'
import type { ImagingSeries } from './contract'
import {
  DEFAULT_VIEWER_CAPABILITIES,
  MAX_SEQUENTIAL_POOL,
  orientationFallbackMessage,
  SEQUENTIAL_LOCALIZER_ORIENTATION_MSG,
} from './policy'
import { nextPoolLoadIndex, POOL_BOOTSTRAP_INDEX, shouldPumpParallelLoads } from './pool-plan'

function toImagingSeries(
  groups: Array<{
    groupId: string
    label?: string
    files: Array<{ url: string; name?: string }>
  }>,
): ImagingSeries[] {
  return groups.map((g) => ({
    id: g.groupId,
    label:
      g.label ??
      dicomSeriesLabel(g.groupId, g.files.length, g.files[0]?.name ?? g.groupId),
    urls: g.files.map((f) => f.url),
    fileCount: g.files.length,
  }))
}

describe('golden Fatima — ImagingSeries + pool bootstrap', () => {
  const FATIMA_IM1_TO_10 = [
    { file_name: 'DICOMS_IM1.dcm', size_bytes: 9676976 },
    { file_name: 'DICOMS_IM1.dcm', size_bytes: 73938 },
    { file_name: 'DICOMS_IM1.dcm', size_bytes: 195238 },
    { file_name: 'DICOMS_IM1.dcm', size_bytes: 203002 },
    { file_name: 'DICOMS_IM1.dcm', size_bytes: 76390 },
    { file_name: 'DICOMS_IM2.dcm', size_bytes: 10192912 },
    { file_name: 'DICOMS_IM2.dcm', size_bytes: 202064 },
    { file_name: 'DICOMS_IM2.dcm', size_bytes: 10837458 },
    { file_name: 'DICOMS_IM10.dcm', size_bytes: 203416 },
    { file_name: 'DICOMS_IM10.dcm', size_bytes: 193648 },
  ]

  it('produit des ImagingSeries cohérentes et bootstrap index 0', () => {
    const files = FATIMA_IM1_TO_10.map((r) => ({
      name: r.file_name,
      url: `mock://${r.size_bytes}`,
      size: r.size_bytes,
    }))
    const series = toImagingSeries(groupDicomFilesIntoSeries(files))
    expect(series.length).toBeGreaterThan(0)
    for (const s of series) {
      expect(s.fileCount).toBe(s.urls.length)
      expect(s.id).toBeTruthy()
      expect(s.label).toBeTruthy()
    }
    const largest = Math.max(...series.map((s) => s.fileCount))
    const poolSize = Math.min(largest, MAX_SEQUENTIAL_POOL)
    expect(shouldPumpParallelLoads(false, poolSize)).toBe(poolSize <= 1)
    expect(nextPoolLoadIndex(0, poolSize, false)).toBe(POOL_BOOTSTRAP_INDEX)
    expect(DEFAULT_VIEWER_CAPABILITIES.pixelSignalGate).toBe(true)
    expect(DEFAULT_VIEWER_CAPABILITIES.jpeg2000OpenJpegFallback).toBe(true)
    expect(DEFAULT_VIEWER_CAPABILITIES.encapsulatedPdf).toBe(true)
  })
})

describe('golden Tania — localizer orientation policy', () => {
  const SERIES = [
    { uid: 'suid-ax-t2-3', desc: 'AX T2 3 LEVELS', n: 21 },
    { uid: 'suid-ax-t2-2', desc: 'AX T2 2 LEVELS', n: 20 },
    { uid: 'suid-ax-t1-post', desc: 'AX T1 FS POST', n: 20 },
    { uid: 'suid-localizer', desc: 'localizer', n: 8 },
  ] as const

  function buildFiles(): MetaImagingFile[] {
    const files: MetaImagingFile[] = []
    let instance = 55616637
    for (const series of SERIES) {
      for (let i = 0; i < series.n; i += 1) {
        files.push({
          name: `33230000_${instance}.dcm`,
          url: `https://example/${instance}`,
          size: 2_000_000,
          seriesInstanceUid: series.uid,
          seriesDescription: series.desc,
          sopInstanceUid: `sop-${instance}`,
          instanceNumber: i + 1,
        })
        instance += 1
      }
    }
    return files
  }

  it('mappe N séries ImagingSeries et message localizer multi-plans', () => {
    const series = toImagingSeries(groupDicomFilesByMetadata(buildFiles()))
    expect(series).toHaveLength(SERIES.length)
    const localizer = series.find((s) => /localizer/i.test(s.label))
    expect(localizer?.fileCount).toBe(8)
    expect(orientationFallbackMessage(localizer?.label)).toBe(
      SEQUENTIAL_LOCALIZER_ORIENTATION_MSG,
    )
    expect(orientationFallbackMessage('AX T2 3 LEVELS')).not.toBe(
      SEQUENTIAL_LOCALIZER_ORIENTATION_MSG,
    )
  })
})
