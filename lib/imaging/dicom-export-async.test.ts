import { describe, expect, it, vi } from 'vitest'
import {
  ASYNC_EXPORT_JOB_TTL_MS,
  ASYNC_EXPORT_STORAGE_ROOT,
  asyncExportPartPath,
  asyncExportStatusPath,
  cleanupExpiredAsyncExports,
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

  it('cleanupExpiredAsyncExports compte et supprime les jobs TTL depasse', async () => {
    const patientId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    const jobId = '11111111-1111-4111-8111-111111111111'
    const nowMs = 1_700_000_000_000
    const expiredAt = new Date(nowMs - 1_000).toISOString()
    const statusBody = JSON.stringify({
      v: 1,
      jobId,
      patientIdHash: 'abcd1234abcd1234',
      status: 'ready',
      createdAt: new Date(nowMs - ASYNC_EXPORT_JOB_TTL_MS - 60_000).toISOString(),
      updatedAt: expiredAt,
      expiresAt: expiredAt,
      fileCount: 1,
      seriesCount: 1,
      totalBytes: 10,
      partCount: 1,
      completedParts: 1,
      parts: [
        {
          index: 0,
          fileCount: 1,
          seriesCount: 1,
          totalBytes: 10,
          storagePath: `${ASYNC_EXPORT_STORAGE_ROOT}/${patientId}/${jobId}/part-1.zip`,
          status: 'ready',
        },
      ],
    })

    const remove = vi.fn(async () => ({ error: null }))
    const list = vi.fn(async (prefix: string) => {
      if (prefix === ASYNC_EXPORT_STORAGE_ROOT) {
        return { data: [{ name: patientId, id: null }], error: null }
      }
      if (prefix === `${ASYNC_EXPORT_STORAGE_ROOT}/${patientId}`) {
        return { data: [{ name: jobId, id: null }], error: null }
      }
      if (prefix === `${ASYNC_EXPORT_STORAGE_ROOT}/${patientId}/${jobId}`) {
        return {
          data: [
            { name: 'status.json', id: 'obj-1' },
            { name: 'part-1.zip', id: 'obj-2' },
          ],
          error: null,
        }
      }
      return { data: [], error: null }
    })
    const download = vi.fn(async () => ({
      data: {
        text: async () => statusBody,
      },
      error: null,
    }))

    const supabase = {
      storage: {
        from: () => ({ list, download, remove }),
      },
    }

    const result = await cleanupExpiredAsyncExports(supabase as never, { nowMs, maxJobs: 10 })
    expect(result).toMatchObject({
      dryRun: false,
      patientPrefixesScanned: 1,
      jobsScanned: 1,
      jobsExpired: 1,
      objectsDeleted: 2,
      listErrors: 0,
      deleteErrors: 0,
      truncated: false,
    })
    expect(remove).toHaveBeenCalledWith([
      `${ASYNC_EXPORT_STORAGE_ROOT}/${patientId}/${jobId}/status.json`,
      `${ASYNC_EXPORT_STORAGE_ROOT}/${patientId}/${jobId}/part-1.zip`,
    ])
  })

  it('cleanupExpiredAsyncExports dryRun ne supprime pas', async () => {
    const patientId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    const jobId = '11111111-1111-4111-8111-111111111111'
    const nowMs = 1_700_000_000_000
    const expiredAt = new Date(nowMs - 1).toISOString()
    const statusBody = JSON.stringify({
      v: 1,
      jobId,
      patientIdHash: 'abcd1234abcd1234',
      status: 'ready',
      createdAt: expiredAt,
      updatedAt: expiredAt,
      expiresAt: expiredAt,
      fileCount: 1,
      seriesCount: 1,
      totalBytes: 1,
      partCount: 1,
      completedParts: 1,
      parts: [],
    })

    const remove = vi.fn(async () => ({ error: null }))
    const list = vi.fn(async (prefix: string) => {
      if (prefix === ASYNC_EXPORT_STORAGE_ROOT) {
        return { data: [{ name: patientId, id: null }], error: null }
      }
      if (prefix === `${ASYNC_EXPORT_STORAGE_ROOT}/${patientId}`) {
        return { data: [{ name: jobId, id: null }], error: null }
      }
      return {
        data: [{ name: 'status.json', id: 'obj-1' }],
        error: null,
      }
    })
    const download = vi.fn(async () => ({
      data: { text: async () => statusBody },
      error: null,
    }))

    const supabase = {
      storage: {
        from: () => ({ list, download, remove }),
      },
    }

    const result = await cleanupExpiredAsyncExports(supabase as never, {
      nowMs,
      dryRun: true,
    })
    expect(result.jobsExpired).toBe(1)
    expect(result.objectsDeleted).toBe(1)
    expect(remove).not.toHaveBeenCalled()
  })
})
