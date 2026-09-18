import { describe, expect, it } from 'vitest'
import {
  buildAsyncStudyExportParts,
  buildStudyExportParts,
  hashSeriesUid,
  MAX_ASYNC_PART_BYTES,
  MAX_ASYNC_PART_FILES,
  MAX_STUDY_EXPORT_FILES,
  normalizeSeriesExportKey,
  planStudyExport,
  resolveSeriesExport,
  resolveStudyExport,
  resolveStudyExportPart,
  sanitizeZipPathSegment,
  type DicomExportRow,
} from './dicom-export'

function row(partial: Partial<DicomExportRow> & Pick<DicomExportRow, 'id' | 'filePath' | 'fileName'>): DicomExportRow {
  return {
    // > bande DOC encapsulé (~80 Ko) — sinon groupement marque isEncapsulatedPdf
    sizeBytes: 500_000,
    seriesInstanceUid: null,
    seriesDescription: null,
    bodyPart: null,
    instanceNumber: null,
    sopInstanceUid: null,
    acquisitionDatetime: null,
    ...partial,
  }
}

describe('dicom-export naming / keys', () => {
  it('hashes series uid without leaking full uid length', () => {
    const h = hashSeriesUid('1.2.840.10008.1.2.1')
    expect(h).toMatch(/^[a-f0-9]{16}$/)
    expect(hashSeriesUid('')).toBeNull()
  })

  it('sanitizes zip path segments', () => {
    expect(sanitizeZipPathSegment('T2 Sag / Cervical!')).toBe('T2_Sag_Cervical')
  })

  it('normalizes suid and raw uid keys', () => {
    expect(normalizeSeriesExportKey('1.2.3.4.5')).toEqual({
      groupId: 'suid:1.2.3.4.5',
      seriesUid: '1.2.3.4.5',
    })
    expect(normalizeSeriesExportKey('suid:1.2.3')).toEqual({
      groupId: 'suid:1.2.3',
      seriesUid: '1.2.3',
    })
    expect(normalizeSeriesExportKey('date:20240101').groupId).toBe('date:20240101')
  })
})

describe('resolveSeriesExport', () => {
  const rows: DicomExportRow[] = [
    row({
      id: 'a',
      filePath: 'patients/p/a.dcm',
      fileName: 'a.dcm',
      seriesInstanceUid: '1.2.3',
      seriesDescription: 'T2 Sag',
      instanceNumber: 1,
      sopInstanceUid: '10.1',
    }),
    row({
      id: 'b',
      filePath: 'patients/p/b.dcm',
      fileName: 'b.dcm',
      seriesInstanceUid: '1.2.3',
      seriesDescription: 'T2 Sag',
      instanceNumber: 2,
      sopInstanceUid: '10.2',
    }),
    row({
      id: 'c',
      filePath: 'patients/p/c.dcm',
      fileName: 'c.dcm',
      seriesInstanceUid: '9.9.9',
      seriesDescription: 'T1',
      instanceNumber: 1,
      sopInstanceUid: '20.1',
    }),
  ]

  it('builds SE###_desc/IM####.dcm paths for one series', () => {
    const resolved = resolveSeriesExport(rows, '1.2.3')
    expect('error' in resolved).toBe(false)
    if ('error' in resolved) return
    expect(resolved.fileCount).toBe(2)
    expect(resolved.exportKind).toBe('series')
    expect(resolved.entries.map((e) => e.zipPath)).toEqual([
      'SE001_T2_Sag/IM0001.dcm',
      'SE001_T2_Sag/IM0002.dcm',
    ])
    expect(resolved.seriesUidHash).toMatch(/^[a-f0-9]{16}$/)
  })

  it('matches groupId suid: prefix', () => {
    const resolved = resolveSeriesExport(rows, encodeURIComponent('suid:9.9.9'))
    expect('error' in resolved).toBe(false)
    if ('error' in resolved) return
    expect(resolved.fileCount).toBe(1)
    expect(resolved.entries[0]?.zipPath).toBe('SE001_T1/IM0001.dcm')
  })

  it('returns not_found for unknown series', () => {
    expect(resolveSeriesExport(rows, '1.2.840.missing')).toEqual({ error: 'not_found' })
  })
})

describe('resolveStudyExport', () => {
  it('includes all image series and excludes empty', () => {
    const rows: DicomExportRow[] = [
      row({
        id: 'a',
        filePath: 'p/a.dcm',
        fileName: 'a.dcm',
        seriesInstanceUid: '1.1',
        seriesDescription: 'A',
        instanceNumber: 1,
        sopInstanceUid: 's1',
      }),
      row({
        id: 'b',
        filePath: 'p/b.dcm',
        fileName: 'b.dcm',
        seriesInstanceUid: '2.2',
        seriesDescription: 'B',
        instanceNumber: 1,
        sopInstanceUid: 's2',
      }),
    ]
    const resolved = resolveStudyExport(rows)
    expect('error' in resolved).toBe(false)
    if ('error' in resolved) return
    expect(resolved.seriesCount).toBe(2)
    expect(resolved.fileCount).toBe(2)
    expect(resolved.entries.some((e) => e.zipPath.startsWith('SE001_'))).toBe(true)
    expect(resolved.entries.some((e) => e.zipPath.startsWith('SE002_'))).toBe(true)
  })

  it('marks Fatima-scale study as too_large for single ZIP', () => {
    const rows: DicomExportRow[] = []
    for (let s = 0; s < 5; s += 1) {
      for (let i = 0; i < 100; i += 1) {
        rows.push(
          row({
            id: `s${s}-i${i}`,
            filePath: `p/${s}/${i}.dcm`,
            fileName: `${i}.dcm`,
            seriesInstanceUid: `1.2.${s}`,
            seriesDescription: `S${s}`,
            instanceNumber: i + 1,
            sopInstanceUid: `10.${s}.${i}`,
          }),
        )
      }
    }
    expect(rows.length).toBeGreaterThan(MAX_STUDY_EXPORT_FILES)
    const resolved = resolveStudyExport(rows)
    expect(resolved).toMatchObject({ error: 'too_large', fileCount: 500 })
  })
})

describe('planStudyExport / chunks', () => {
  it('plans single mode under plafond', () => {
    const rows = [
      row({
        id: 'a',
        filePath: 'p/a.dcm',
        fileName: 'a.dcm',
        seriesInstanceUid: '1.1',
        sopInstanceUid: 's1',
      }),
    ]
    expect(planStudyExport(rows)).toMatchObject({
      mode: 'single',
      partCount: 1,
      fileCount: 1,
      recommendAsync: false,
    })
  })

  it('splits oversized study into multiple parts under plafond each', () => {
    const rows: DicomExportRow[] = []
    for (let s = 0; s < 5; s += 1) {
      for (let i = 0; i < 100; i += 1) {
        rows.push(
          row({
            id: `s${s}-i${i}`,
            filePath: `p/${s}/${i}.dcm`,
            fileName: `${i}.dcm`,
            seriesInstanceUid: `1.2.${s}`,
            seriesDescription: `S${s}`,
            instanceNumber: i + 1,
            sopInstanceUid: `10.${s}.${i}`,
          }),
        )
      }
    }
    const plan = planStudyExport(rows)
    expect(plan).toMatchObject({ mode: 'chunked', fileCount: 500, recommendAsync: true })
    if ('error' in plan || plan.mode !== 'chunked') return
    expect(plan.partCount).toBeGreaterThan(1)
    expect(plan.asyncPartCount).toBeGreaterThanOrEqual(plan.partCount)
    expect(plan.parts.every((p) => p.fileCount <= MAX_STUDY_EXPORT_FILES)).toBe(true)

    const parts = buildStudyExportParts(rows)
    expect(parts.length).toBe(plan.partCount)
    const part0 = resolveStudyExportPart(rows, 0)
    expect('error' in part0).toBe(false)
    if ('error' in part0) return
    expect(part0.fileCount).toBe(plan.parts[0]?.fileCount)
    expect(resolveStudyExportPart(rows, 99)).toMatchObject({ error: 'part_out_of_range' })
  })
})

describe('buildStudyExportParts / buildAsyncStudyExportParts file-level split', () => {
  function seriesRows(
    uid: string,
    count: number,
    sizeBytes: number,
    desc: string,
  ): DicomExportRow[] {
    const rows: DicomExportRow[] = []
    for (let i = 0; i < count; i += 1) {
      rows.push(
        row({
          id: `${uid}-${i}`,
          filePath: `p/${uid}/${i}.dcm`,
          fileName: `${i}.dcm`,
          sizeBytes,
          seriesInstanceUid: uid,
          seriesDescription: desc,
          instanceNumber: i + 1,
          sopInstanceUid: `${uid}.${i}`,
        }),
      )
    }
    return rows
  }

  it('splits a 110-file series under the byte cap by file count', () => {
    // 110 * 200 Ko = 22 Mo < 42 Mo → le plafond fichiers (80) tranche.
    const rows = seriesRows('1.2.110', 110, 200_000, 'LOMBAIRE_ROUTINE')
    const parts = buildAsyncStudyExportParts(rows)
    expect(parts.reduce((sum, p) => sum + p.fileCount, 0)).toBe(110)
    expect(parts.length).toBeGreaterThan(1)
    expect(parts.every((p) => p.fileCount <= MAX_ASYNC_PART_FILES)).toBe(true)
    expect(parts.every((p) => p.totalBytes <= MAX_ASYNC_PART_BYTES)).toBe(true)
    expect(parts[0]?.fileCount).toBe(MAX_ASYNC_PART_FILES)
    expect(parts[1]?.fileCount).toBe(110 - MAX_ASYNC_PART_FILES)

    const syncParts = buildStudyExportParts(rows)
    expect(syncParts).toHaveLength(1)
    expect(syncParts[0]?.fileCount).toBe(110)
  })

  it('splits a series of few huge files by bytes', () => {
    // 6 * 25 Mo = 150 Mo ; 25+25=50 Mo > 42 Mo → une image par partie.
    const rows = seriesRows('1.2.scan', 6, 25_000_000, 'REQUETE_NUMERISEE')
    const parts = buildAsyncStudyExportParts(rows)
    expect(parts).toHaveLength(6)
    expect(parts.every((p) => p.fileCount === 1 && p.totalBytes === 25_000_000)).toBe(true)
    expect(parts.reduce((sum, p) => sum + p.fileCount, 0)).toBe(6)
  })

  it('keeps small series packed together under async caps', () => {
    const rows = [
      ...seriesRows('1.2.a', 10, 500_000, 'T2'),
      ...seriesRows('1.2.b', 10, 500_000, 'T1'),
    ]
    const parts = buildAsyncStudyExportParts(rows)
    expect(parts).toHaveLength(1)
    expect(parts[0]?.fileCount).toBe(20)
    expect(parts[0]?.seriesCount).toBe(2)
    expect(parts[0]?.totalBytes).toBe(10_000_000)
  })

  it('allows a single file larger than the byte cap as its own part', () => {
    const rows = seriesRows('1.2.huge', 1, 60_000_000, 'LOCALIZER')
    const parts = buildAsyncStudyExportParts(rows)
    expect(parts).toHaveLength(1)
    expect(parts[0]?.fileCount).toBe(1)
    expect(parts[0]?.totalBytes).toBe(60_000_000)
  })
})
