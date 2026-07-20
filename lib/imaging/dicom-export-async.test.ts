import { describe, expect, it } from 'vitest'
import {
  ASYNC_EXPORT_JOB_TTL_MS,
  asyncExportPartPath,
  asyncExportStatusPath,
  createAsyncExportJobRecord,
  isValidAsyncExportJobId,
} from './dicom-export-async'
import { MAX_ASYNC_PART_FILES, type DicomExportRow } from './dicom-export'

function row(
  partial: Partial<DicomExportRow> & Pick<DicomExportRow, 'id' | 'filePath' | 'fileName'>,
): DicomExportRow {
  return {
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

describe('dicom-export-async helpers', () => {
  it('valide jobId UUID', () => {
    expect(isValidAsyncExportJobId('11111111-1111-4111-8111-111111111111')).toBe(true)
    expect(isValidAsyncExportJobId('not-a-uuid')).toBe(false)
  })

  it('construit des chemins Storage sans PHI dans le nom de fichier', () => {
    const patientId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    const jobId = '11111111-1111-4111-8111-111111111111'
    expect(asyncExportStatusPath(patientId, jobId)).toBe(
      `exports/${patientId}/${jobId}/status.json`,
    )
    expect(asyncExportPartPath(patientId, jobId, 0)).toBe(
      `exports/${patientId}/${jobId}/part-1.zip`,
    )
  })

  it('cree un job avec parties sous plafond async', () => {
    const patientId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
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

    const created = createAsyncExportJobRecord(patientId, rows, 1_700_000_000_000)
    expect('error' in created).toBe(false)
    if ('error' in created) return

    expect(created.v).toBe(1)
    expect(isValidAsyncExportJobId(created.jobId)).toBe(true)
    expect(created.fileCount).toBe(500)
    expect(created.partCount).toBeGreaterThan(1)
    // Série seule > plafond fichiers : partie mono-série (même règle que sync).
    expect(created.parts.every((p) => p.fileCount > 0 && p.status === 'pending')).toBe(true)
    expect(MAX_ASYNC_PART_FILES).toBe(80)
    expect(created.status).toBe('queued')
    expect(Date.parse(created.expiresAt) - Date.parse(created.createdAt)).toBe(
      ASYNC_EXPORT_JOB_TTL_MS,
    )
    expect(created.patientIdHash).toMatch(/^[a-f0-9]{16}$/)
  })

  it('retourne empty sans DICOM image', () => {
    expect(createAsyncExportJobRecord('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', [])).toEqual({
      error: 'empty',
    })
  })
})
