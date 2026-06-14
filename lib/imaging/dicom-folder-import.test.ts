import { describe, expect, it } from 'vitest'
import {
  ensureDicomExtension,
  hasDicomPreamble,
  parseDicomHeaderInfo,
} from '@/lib/imaging/dicom-detection'
import {
  dicomSeriesImportLabel,
  formatEmptyDicomFolderMessage,
  importDicomFolder,
  prepareDicomUploadFile,
} from '@/lib/imaging/dicom-folder-import'
import { fileRelativePath } from '@/lib/imaging/directory-picker'
import { isIgnorableCompanionFile } from '@/lib/documents/patient-documents'

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

function buildMinimalDicom(opts: { seriesUid: string; modality?: string }): Uint8Array {
  const chunks: number[] = new Array(128).fill(0)
  chunks.push(0x44, 0x49, 0x43, 0x4d)
  appendExplicitTag(chunks, 0x0002, 0x0010, 'UI', '1.2.840.10008.1.2.1')
  appendExplicitTag(chunks, 0x0020, 0x000e, 'UI', opts.seriesUid)
  if (opts.modality) {
    appendExplicitTag(chunks, 0x0008, 0x0060, 'CS', opts.modality)
  }
  return new Uint8Array(chunks)
}

function toArrayBuffer(u: Uint8Array): ArrayBuffer {
  return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer
}

function mockFileWithPath(name: string, content: Uint8Array, relativePath: string): File {
  const file = new File([toArrayBuffer(content)], name, { type: 'application/octet-stream' })
  Object.defineProperty(file, 'webkitRelativePath', { value: relativePath })
  return file
}

describe('dicom-folder-import', () => {
  it('detecte DICM a offset 128', () => {
    const bytes = new Uint8Array(132)
    bytes.set([0x44, 0x49, 0x43, 0x4d], 128)
    expect(hasDicomPreamble(bytes)).toBe(true)
  })

  it('ignore les fichiers parasites de CD', () => {
    expect(isIgnorableCompanionFile('DICOMDIR')).toBe(true)
    expect(isIgnorableCompanionFile('viewer.exe')).toBe(true)
    expect(isIgnorableCompanionFile('IM000001')).toBe(false)
  })

  it('renomme IM000001 sans extension en .dcm', () => {
    const bytes = buildMinimalDicom({ seriesUid: '1.2.3.4.5', modality: 'MR' })
    const original = new File([toArrayBuffer(bytes)], 'IM000001', { type: 'application/octet-stream' })
    const prepared = prepareDicomUploadFile(original, {
      seriesInstanceUid: '1.2.3.4.5',
      modality: 'MR',
      sopInstanceUid: null,
    })
    expect(prepared.name).toBe('IM000001.dcm')
    expect(prepared.type).toBe('application/dicom')
    expect(ensureDicomExtension('IM000001')).toBe('IM000001.dcm')
  })

  it('importe une structure CD PA/ST/SE/IM avec webkitRelativePath', async () => {
    const seriesA = buildMinimalDicom({ seriesUid: '1.2.3.4.5', modality: 'MR' })
    const seriesB = buildMinimalDicom({ seriesUid: '9.8.7.6.5', modality: 'MR' })
    const files = [
      mockFileWithPath(
        'IM000001',
        seriesA,
        'DICOM IRM/DICOM/PA000001/ST000001/SE000005/IM000001',
      ),
      mockFileWithPath(
        'IM000002',
        seriesA,
        'DICOM IRM/DICOM/PA000001/ST000001/SE000005/IM000002',
      ),
      mockFileWithPath(
        'IM000001.dcm',
        seriesB,
        'DICOM IRM/SE000004/IM000001.dcm',
      ),
      mockFileWithPath('DICOMDIR', new Uint8Array([1, 2, 3]), 'DICOM IRM/DICOMDIR'),
    ]

    const result = await importDicomFolder(files)
    expect(result.series).toHaveLength(2)
    expect(result.series[0]?.files).toHaveLength(2)
    expect(result.series[1]?.files).toHaveLength(1)
    expect(result.ignoredCompanionCount).toBe(1)
    expect(result.skippedNonDicomCount).toBe(0)
    expect(dicomSeriesImportLabel('MR', 0, 2)).toMatch(/IRM/)
    expect(fileRelativePath(files[0]!)).toContain('SE000005/IM000001')
  })

  it('parse SeriesInstanceUID depuis en-tete minimal', () => {
    const bytes = buildMinimalDicom({
      seriesUid: '1.2.840.113619.2.55.3.604688123.123.1234567890.123',
      modality: 'MR',
    })
    const info = parseDicomHeaderInfo(bytes)
    expect(info?.seriesInstanceUid).toBe('1.2.840.113619.2.55.3.604688123.123.1234567890.123')
    expect(info?.modality).toBe('MR')
  })

  it('formate une erreur explicite quand aucun DICOM', async () => {
    const files = [
      mockFileWithPath('NOTES', new Uint8Array([1, 2, 3, 4]), 'Arcande_IRM/README.txt'),
      mockFileWithPath('00000000.dcm', new Uint8Array([1, 2, 3, 4]), 'Arcande_IRM/DICOMOBJ/00000000.dcm'),
    ]
    const result = await importDicomFolder(files)
    expect(result.series).toHaveLength(0)
    const message = formatEmptyDicomFolderMessage(result)
    expect(message).toContain('Aucune image DICOM')
    expect(message).toMatch(/Arcande_IRM/)
  })
})
