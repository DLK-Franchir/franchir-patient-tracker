/**
 * Regroupe les fichiers DICOM listés depuis Storage en séries distinctes.
 */

export type NamedImagingFile = {
  name: string
  url: string
  /** Taille en octets (Storage) — résout les re-uploads partiels d'une même coupe. */
  size?: number | null
}

export function stripStorageTimestampPrefix(storageName: string): string {
  const base = storageName.split('/').pop() ?? storageName
  const match = base.match(/^\d+_(.+)$/)
  return match ? match[1] : base
}

function storageTimestampPrefix(storageName: string): number {
  const base = storageName.split('/').pop() ?? storageName
  const match = base.match(/^(\d+)_/)
  return match ? Number(match[1]) : 0
}

export function dicomSeriesGroupId(storageName: string): string {
  const stripped = stripStorageTimestampPrefix(storageName)

  const seMatch = stripped.match(/^(SE\d+)_/i)
  if (seMatch) return `series:${seMatch[1]!.toUpperCase()}`

  const seriesMatch = stripped.match(/^(Series\d*)_/i)
  if (seriesMatch) return `series:${seriesMatch[1]!}`

  if (/^0+\d+\.(dcm|dicom)$/i.test(stripped)) return 'marcel-cd'

  if (/^IM\d+\.(dcm|dicom)$/i.test(stripped)) return 'patient-im'

  const stem = stripped.replace(/\.(dcm|dicom)$/i, '')
  const prefixMatch = stem.match(/^([A-Za-z0-9]+)_/)
  if (prefixMatch) return `series:${prefixMatch[1]}`

  return `series:${stem.replace(/\d+$/, '') || stripped}`
}

function fileSizeBytes(file: NamedImagingFile): number | null {
  if (typeof file.size === 'number' && file.size > 0) return file.size
  return null
}

function medianSize(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? null
}

function pickDuplicateVersion<T extends NamedImagingFile>(
  candidates: T[],
  referenceSize: number | null,
): T {
  if (candidates.length === 1) return candidates[0]!

  let ref = referenceSize
  if (ref === null) {
    const candidateSizes = candidates
      .map((file) => fileSizeBytes(file))
      .filter((size): size is number => size !== null)
    ref = medianSize(candidateSizes)
  }

  if (ref !== null && ref > 0) {
    return candidates.reduce((best, cur) => {
      const curSize = fileSizeBytes(cur)
      const bestSize = fileSizeBytes(best)
      const curDist =
        curSize !== null ? Math.abs(curSize - ref!) : Number.POSITIVE_INFINITY
      const bestDist =
        bestSize !== null ? Math.abs(bestSize - ref!) : Number.POSITIVE_INFINITY
      if (curDist !== bestDist) return curDist < bestDist ? cur : best
      return storageTimestampPrefix(cur.name) >= storageTimestampPrefix(best.name) ? cur : best
    })
  }

  return candidates.reduce((best, cur) =>
    storageTimestampPrefix(cur.name) <= storageTimestampPrefix(best.name) ? cur : best,
  )
}

function dedupeSeriesGroupFiles<T extends NamedImagingFile>(files: T[]): T[] {
  const byBasename = new Map<string, T[]>()
  for (const file of files) {
    const base = stripStorageTimestampPrefix(file.name)
    const list = byBasename.get(base) ?? []
    list.push(file)
    byBasename.set(base, list)
  }

  const singletonSizes = [...byBasename.values()]
    .filter((list) => list.length === 1)
    .map((list) => fileSizeBytes(list[0]!))
    .filter((size): size is number => size !== null)

  const referenceSize = medianSize(singletonSizes)
  const deduped: T[] = []
  for (const candidates of byBasename.values()) {
    deduped.push(pickDuplicateVersion(candidates, referenceSize))
  }
  return deduped.sort((a, b) => a.name.localeCompare(b.name))
}

export function dedupeDicomFilesByBasename<T extends NamedImagingFile>(files: T[]): T[] {
  const bySeries = new Map<string, T[]>()
  for (const file of files) {
    const groupId = dicomSeriesGroupId(file.name)
    const list = bySeries.get(groupId) ?? []
    list.push(file)
    bySeries.set(groupId, list)
  }

  const result: T[] = []
  for (const seriesFiles of bySeries.values()) {
    result.push(...dedupeSeriesGroupFiles(seriesFiles))
  }
  return result.sort((a, b) => a.name.localeCompare(b.name))
}

export function dicomSeriesLabel(groupId: string, count: number, singleName: string): string {
  const stripped = stripStorageTimestampPrefix(singleName)
  if (count <= 1) return stripped

  const seFromName = stripped.match(/^(SE\d+)_/i)
  if (seFromName) return `Série ${seFromName[1]!.toUpperCase()} (${count} fichiers)`

  if (groupId === 'patient-im') return `Série DICOM patient (${count} fichiers)`
  if (groupId === 'series:DICOMOBJ') return `Série DICOMOBJ (${count} fichiers)`
  return `Série DICOM (${count} fichiers)`
}

const GROUP_ORDER = ['patient-im', 'marcel-cd'] as const

export function groupDicomFilesIntoSeries<T extends NamedImagingFile>(
  files: T[],
): Array<{ groupId: string; files: T[] }> {
  const deduped = dedupeDicomFilesByBasename(files)
  const groups = new Map<string, T[]>()
  for (const file of deduped) {
    const groupId = dicomSeriesGroupId(file.name)
    const list = groups.get(groupId) ?? []
    list.push(file)
    groups.set(groupId, list)
  }

  for (const list of groups.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name))
  }

  const orderedIds = [
    ...GROUP_ORDER.filter((id) => groups.has(id)),
    ...Array.from(groups.keys())
      .filter((id) => !GROUP_ORDER.includes(id as (typeof GROUP_ORDER)[number]))
      .sort(),
  ]

  return orderedIds.map((groupId) => ({
    groupId,
    files: groups.get(groupId) ?? [],
  }))
}
