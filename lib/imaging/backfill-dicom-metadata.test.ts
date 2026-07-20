import { beforeEach, describe, expect, it, vi } from 'vitest'
import { backfillPatientDicomMetadata } from '@/lib/imaging/backfill-dicom-metadata'

function appendExplicitTag(
  chunks: number[],
  group: number,
  element: number,
  vr: string,
  value: string,
): void {
  chunks.push(group & 0xff, (group >> 8) & 0xff)
  chunks.push(element & 0xff, (element >> 8) & 0xff)
  chunks.push(vr.charCodeAt(0)!, vr.charCodeAt(1)!)
  const valueBytes = new TextEncoder().encode(value)
  let len = valueBytes.length
  if (len % 2 !== 0) len += 1
  chunks.push(len & 0xff, (len >> 8) & 0xff)
  for (const b of valueBytes) chunks.push(b)
  if (valueBytes.length % 2 !== 0) chunks.push(0)
}

function buildMinimalDicom(seriesUid: string, sopUid: string): ArrayBuffer {
  const chunks: number[] = new Array(128).fill(0)
  chunks.push(0x44, 0x49, 0x43, 0x4d)
  appendExplicitTag(chunks, 0x0002, 0x0010, 'UI', '1.2.840.10008.1.2.1')
  appendExplicitTag(chunks, 0x0020, 0x000e, 'UI', seriesUid)
  appendExplicitTag(chunks, 0x0008, 0x0018, 'UI', sopUid)
  return new Uint8Array(chunks).buffer
}

describe('backfillPatientDicomMetadata', () => {
  const patientId = '11111111-1111-1111-1111-111111111111'
  const updates: Array<{ id: string; patch: Record<string, unknown> }> = []

  beforeEach(() => {
    updates.length = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 206,
        arrayBuffer: async () => buildMinimalDicom('1.2.3.series', '1.2.3.sop'),
      })),
    )
  })

  function makeClient(rows: Array<{ id: string; file_path: string }>) {
    return {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  is: async () => ({ data: rows, error: null }),
                }),
              }),
            }),
          }),
        }),
        update: (patch: Record<string, unknown>) => ({
          eq: async (_col: string, id: string) => {
            updates.push({ id, patch })
            return { error: null }
          },
        }),
      }),
      storage: {
        from: () => ({
          createSignedUrl: async () => ({
            data: { signedUrl: 'https://example.test/object' },
            error: null,
          }),
        }),
      },
    }
  }

  it('dry-run compte les updates sans ecrire', async () => {
    const client = makeClient([
      { id: 'a', file_path: 'patients/x/1.dcm' },
      { id: 'b', file_path: 'patients/x/2.dcm' },
    ])
    const result = await backfillPatientDicomMetadata(client as never, {
      patientId,
      dryRun: true,
    })
    expect(result.scanned).toBe(2)
    expect(result.parseOk).toBe(2)
    expect(result.updated).toBe(2)
    expect(updates).toHaveLength(0)
  })

  it('ecrit series_instance_uid en mode apply', async () => {
    const client = makeClient([{ id: 'row-1', file_path: 'patients/x/1.dcm' }])
    const result = await backfillPatientDicomMetadata(client as never, {
      patientId,
      dryRun: false,
    })
    expect(result.updated).toBe(1)
    expect(updates).toHaveLength(1)
    expect(updates[0]?.patch.series_instance_uid).toBe('1.2.3.series')
    expect(updates[0]?.patch.sop_instance_uid).toBe('1.2.3.sop')
  })
})
