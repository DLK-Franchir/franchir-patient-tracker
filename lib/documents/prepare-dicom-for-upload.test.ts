import { describe, expect, it } from 'vitest'
import { prepareDicomForUpload } from '@/lib/documents/prepare-dicom-for-upload'
import { extractSeriesUidFromStorageName } from '@/lib/imaging/dicom-series-uid-name'

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

function buildMinimalDicom(opts: {
  seriesUid: string
  sopUid?: string
}): Uint8Array {
  const chunks: number[] = new Array(128).fill(0)
  chunks.push(0x44, 0x49, 0x43, 0x4d)
  appendExplicitTag(chunks, 0x0002, 0x0010, 'UI', '1.2.840.10008.1.2.1')
  appendExplicitTag(chunks, 0x0020, 0x000e, 'UI', opts.seriesUid)
  if (opts.sopUid) {
    appendExplicitTag(chunks, 0x0008, 0x0018, 'UI', opts.sopUid)
  }
  return new Uint8Array(chunks)
}

function toArrayBuffer(u: Uint8Array): ArrayBuffer {
  return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer
}

describe('prepareDicomForUpload', () => {
  it('encode SeriesInstanceUID dans le nom pour un DICOM brut', async () => {
    const seriesUid = '1.2.840.10008.1.2.3.series'
    const bytes = buildMinimalDicom({ seriesUid, sopUid: '1.2.3.sop' })
    const original = new File([toArrayBuffer(bytes)], 'IM000001', {
      type: 'application/octet-stream',
    })

    const { file, dicom } = await prepareDicomForUpload(original)

    expect(dicom?.seriesInstanceUid).toBe(seriesUid)
    expect(dicom?.sopInstanceUid).toBe('1.2.3.sop')
    expect(file.name.startsWith('SUID.')).toBe(true)
    expect(extractSeriesUidFromStorageName(file.name)).toBe(seriesUid)
  })

  it('ne renomme pas un fichier deja prefixe SUID', async () => {
    const seriesUid = '1.2.3.already'
    const bytes = buildMinimalDicom({ seriesUid })
    // prepare once to get a SUID name, then re-prepare
    const first = await prepareDicomForUpload(
      new File([toArrayBuffer(bytes)], 'slice.dcm', { type: 'application/dicom' }),
    )
    const second = await prepareDicomForUpload(first.file)
    expect(second.file.name).toBe(first.file.name)
  })

  it('laisse les PDF intacts', async () => {
    const pdf = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'note.pdf', {
      type: 'application/pdf',
    })
    const { file, dicom } = await prepareDicomForUpload(pdf)
    expect(file.name).toBe('note.pdf')
    expect(dicom).toBeNull()
  })
})
