import { describe, expect, it } from 'vitest'
import {
  extractImIndex,
  groupDicomFilesIntoSeries,
  pickPreferredBootstrapIndex,
} from '@/lib/imaging/dicom-series-group'

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

function toFiles(rows: Array<{ file_name: string; size_bytes: number }>) {
  return rows.map((r) => ({
    name: r.file_name,
    url: `mock://${r.size_bytes}`,
    size: r.size_bytes,
  }))
}

describe('Fatima DICOMS_IM regression', () => {
  it('tri naturel IM2 avant IM10', () => {
    expect(extractImIndex('DICOMS_IM2.dcm')).toBe(2)
    expect(extractImIndex('DICOMS_IM10.dcm')).toBe(10)
    const files = toFiles([
      { file_name: 'DICOMS_IM10.dcm', size_bytes: 200_000 },
      { file_name: 'DICOMS_IM2.dcm', size_bytes: 200_000 },
    ])
    const groups = groupDicomFilesIntoSeries(files)
    expect(groups[0]?.files.map((f) => f.name)).toEqual(['DICOMS_IM2.dcm', 'DICOMS_IM10.dcm'])
  })

  it('bootstrap index 0 evite le volume 9 Mo sur DICOMS_IM1', () => {
    const files = toFiles(FATIMA_IM1_TO_10)
    const groups = groupDicomFilesIntoSeries(files)
    expect(groups).toHaveLength(1)
    const first = groups[0]!.files[0]!
    expect(first.size).toBeGreaterThanOrEqual(120_000)
    expect(first.size).toBeLessThanOrEqual(800_000)
    expect(first.size).not.toBe(9_676_976)
  })

  it('CD Husain local : IM1 DOC saute, bootstrap sur DX ~8 Mo', () => {
    const files = toFiles([
      { file_name: 'IM1', size_bytes: 76_390 },
      { file_name: 'IM2', size_bytes: 8_320_632 },
      { file_name: 'IM3', size_bytes: 8_441_874 },
      { file_name: 'IM4', size_bytes: 8_151_920 },
      { file_name: 'IM5', size_bytes: 8_508_944 },
    ])
    const groups = groupDicomFilesIntoSeries(files)
    expect(groups).toHaveLength(1)
    const first = groups[0]!.files[0]!
    expect(first.name).toBe('IM2')
    expect(first.size).toBeGreaterThan(1_000_000)
  })

  it('pickPreferredBootstrapIndex choisit une coupe ~200 Ko', () => {
    const files = toFiles(FATIMA_IM1_TO_10)
    const index = pickPreferredBootstrapIndex(files)
    expect(files[index]?.size).toBeGreaterThanOrEqual(190_000)
    expect(files[index]?.size).toBeLessThanOrEqual(210_000)
  })
})
