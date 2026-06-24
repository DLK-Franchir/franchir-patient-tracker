import { describe, expect, it } from 'vitest'
import {
  ensureDicomExtension,
  hasDicomPreamble,
  hasLikelyRawDicomStructure,
  parseDicomHeaderInfo,
} from '@/lib/imaging/dicom-detection'
import {
  buildUniqueUploadName,
  dicomSeriesImportLabel,
  extractSeriesFolderKey,
  formatEmptyDicomFolderMessage,
  importDicomFolder,
  prepareDicomUploadFile,
  resolveSeriesKey,
} from '@/lib/imaging/dicom-folder-import'
import { fileRelativePath } from '@/lib/imaging/directory-picker'
import { isIgnorableCompanionFile } from '@/lib/documents/patient-documents'
import { dicomSeriesGroupId, groupDicomFilesIntoSeries } from '@/lib/imaging/dicom-series-group'

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

  it('renomme avec prefixe SE pour eviter collisions', () => {
    const bytes = buildMinimalDicom({ seriesUid: '1.2.3.4.5', modality: 'MR' })
    const path = 'DICOM IRM/DICOM/PA000001/ST000001/SE000005/IM000001'
    const original = new File([toArrayBuffer(bytes)], 'IM000001', { type: 'application/octet-stream' })
    const prepared = prepareDicomUploadFile(original, path, {
      seriesInstanceUid: '1.2.3.4.5',
      modality: 'MR',
      sopInstanceUid: null,
    })
    expect(prepared.name).toBe('SE000005_IM000001.dcm')
    expect(prepared.type).toBe('application/dicom')
    expect(ensureDicomExtension('IM000001')).toBe('IM000001.dcm')
  })

  it('produit des noms uniques pour 10+ IM000001 dans des SE differents', () => {
    const names = new Set<string>()
    for (let i = 2; i <= 12; i += 1) {
      const se = `SE${String(i).padStart(6, '0')}`
      const path = `Arcande_IRM/DICOM/PA000001/ST000001/${se}/IM000001`
      names.add(buildUniqueUploadName(path, 'IM000001'))
    }
    expect(names.size).toBe(11)
  })

  it('importe structure Arcande_IRM PA/ST/SE/IM en series separees', async () => {
    const seriesA = buildMinimalDicom({ seriesUid: '1.2.3.4.5', modality: 'MR' })
    const seriesB = buildMinimalDicom({ seriesUid: '9.8.7.6.5', modality: 'MR' })
    const seriesC = buildMinimalDicom({ seriesUid: '9.8.7.6.6', modality: 'MR' })
    const seriesD = buildMinimalDicom({ seriesUid: '9.8.7.6.7', modality: 'MR' })

    const files = [
      mockFileWithPath('IM000001', seriesA, 'Arcande_IRM/DICOM/PA000001/ST000001/SE000005/IM000001'),
      mockFileWithPath('IM000002', seriesA, 'Arcande_IRM/DICOM/PA000001/ST000001/SE000005/IM000002'),
      mockFileWithPath('IM000001.dcm', seriesB, 'Arcande_IRM/DICOM/PA000001/ST000001/SE000004/IM000001.dcm'),
      mockFileWithPath('IM000001', seriesC, 'Arcande_IRM/DICOM/PA000001/ST000001/SE000003/IM000001'),
      mockFileWithPath('IM000001', seriesD, 'Arcande_IRM/DICOM/PA000001/ST000001/SE000002/IM000001'),
      mockFileWithPath('00000000.dcm', buildMinimalDicom({ seriesUid: 'cd.1' }), 'Arcande_IRM/DICOMOBJ/00000000.dcm'),
      mockFileWithPath('DICOMDIR', new Uint8Array([1, 2, 3]), 'Arcande_IRM/DICOMDIR'),
    ]

    const result = await importDicomFolder(files)
    expect(result.series).toHaveLength(5)
    expect(result.ignoredCompanionCount).toBe(1)
    expect(result.skippedNonDicomCount).toBe(0)
    expect(extractSeriesFolderKey('Arcande_IRM/DICOM/PA000001/ST000001/SE000005/IM000001')).toContain('SE000005')
    expect(resolveSeriesKey(null, 'Arcande_IRM/DICOM/PA000001/ST000001/SE000004/IM000001.dcm')).toContain('SE000004')

    const uploadNames = result.series.flatMap((s) => s.files.map((f) => f.file.name))
    expect(new Set(uploadNames).size).toBe(uploadNames.length)
    expect(dicomSeriesImportLabel('MR', 0, 2, 'Arcande_IRM/DICOM/PA000001/ST000001/SE000005')).toMatch(/SE000005/)
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

  it('detecte raw DICOM sans preamble', () => {
    const chunks: number[] = []
    appendExplicitTag(chunks, 0x0008, 0x0060, 'CS', 'MR')
    expect(hasLikelyRawDicomStructure(new Uint8Array(chunks))).toBe(true)
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

describe('dicom-series-group SE prefix', () => {
  it('groupe par prefixe SE', () => {
    expect(dicomSeriesGroupId('1781451087388_SE000005_IM000001.dcm')).toBe('series:SE000005')
    const groups = groupDicomFilesIntoSeries([
      { name: '1781451087388_SE000005_IM000001.dcm', url: 'a1' },
      { name: '1781451087388_SE000005_IM000002.dcm', url: 'a2' },
      { name: '1781451087388_SE000004_IM000001.dcm', url: 'b1' },
    ])
    expect(groups).toHaveLength(2)
    expect(groups.find((g) => g.groupId === 'series:SE000005')?.files).toHaveLength(2)
  })

  it('groupe DICOMS_IM en patient-im et non series:DICOMS', () => {
    expect(dicomSeriesGroupId('1781451087388_DICOMS_IM000001.dcm')).toBe('patient-im')
    expect(dicomSeriesGroupId('1781451087388_DICOMS_IM000042')).toBe('patient-im')
    const groups = groupDicomFilesIntoSeries([
      { name: '1781451087388_DICOMS_IM000001.dcm', url: 'a1', size: 100_000 },
      { name: '1781451087388_DICOMS_IM000002.dcm', url: 'a2', size: 100_000 },
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0]?.groupId).toBe('patient-im')
    expect(groups[0]?.files).toHaveLength(2)
  })

  it('scinde patient-im heterogene en lots de taille (CD Fatima)', () => {
    const rows: Array<{ name: string; url: string; size: number }> = []
    for (let im = 1; im <= 120; im += 1) {
      rows.push({ name: `DICOMS_IM${im}.dcm`, url: `a${im}`, size: 200_000 })
    }
    for (let im = 334; im <= 420; im += 1) {
      rows.push({ name: `DICOMS_IM${im}.dcm`, url: `b${im}`, size: 98_000 })
    }
    for (let im = 1; im <= 5; im += 1) {
      rows.push({ name: `DICOMS_IM${im}.dcm`, url: `big${im}`, size: 9_000_000 })
    }
    const groups = groupDicomFilesIntoSeries(rows)
    expect(groups.length).toBeGreaterThan(1)
    expect(groups.every((g) => g.groupId.startsWith('patient-im'))).toBe(true)
    const primary = groups.find((g) => g.files.some((f) => f.size === 200_000))
    expect(primary?.files[0]?.size).toBeGreaterThanOrEqual(120_000)
    expect(primary?.files[0]?.size).toBeLessThanOrEqual(800_000)
  })

  it('conserve les homonymes CD quand les tailles divergent (>10%)', () => {
    const groups = groupDicomFilesIntoSeries([
      { name: '1781451087388_DICOMS_IM000001.dcm', url: 'seq-a', size: 100_000 },
      { name: '1781451087388_DICOMS_IM000001.dcm', url: 'seq-b', size: 500_000 },
      { name: '1781451087388_DICOMS_IM000001.dcm', url: 'seq-b-dup', size: 510_000 },
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0]?.files).toHaveLength(2)
  })

  it('deduplique les re-uploads homonymes de taille proche', () => {
    const groups = groupDicomFilesIntoSeries([
      { name: '1781451087388_DICOMS_IM000001.dcm', url: 'old', size: 100_000 },
      { name: '1781451087388_DICOMS_IM000001.dcm', url: 'new', size: 102_000 },
    ])
    expect(groups[0]?.files).toHaveLength(1)
  })
})
