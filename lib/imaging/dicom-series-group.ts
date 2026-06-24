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

  // CD patient : IM* ou DICOMS_IM* (export plat) — une série commune, pas series:DICOMS.
  if (/^IM\d+(\.(dcm|dicom))?$/i.test(stripped)) return 'patient-im'
  if (/^DICOMS_IM\d+(\.(dcm|dicom))?$/i.test(stripped)) return 'patient-im'

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

/** Écart relatif de taille au-delà duquel deux fichiers homonymes sont des séquences distinctes. */
const SIZE_DEDUPE_THRESHOLD = 0.1

function sizesAreDistinct(a: number, b: number): boolean {
  const max = Math.max(a, b)
  if (max <= 0) return false
  return Math.abs(a - b) / max > SIZE_DEDUPE_THRESHOLD
}

function clusterBySimilarSize<T extends NamedImagingFile>(candidates: T[]): T[][] {
  const clusters: T[][] = []
  for (const file of candidates) {
    const size = fileSizeBytes(file)
    if (size === null) {
      clusters.push([file])
      continue
    }
    const cluster = clusters.find((group) => {
      const ref = fileSizeBytes(group[0]!)
      return ref !== null && !sizesAreDistinct(size, ref)
    })
    if (cluster) {
      cluster.push(file)
    } else {
      clusters.push([file])
    }
  }
  return clusters
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
    for (const cluster of clusterBySimilarSize(candidates)) {
      deduped.push(pickDuplicateVersion(cluster, referenceSize))
    }
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
  const bandMatch = groupId.match(/^patient-im-band-(\d+)$/)
  if (bandMatch) {
    const bandNum = Number(bandMatch[1]!) + 1
    return `Série DICOM patient — lot ${bandNum} (${count} fichiers)`
  }
  if (groupId === 'series:DICOMOBJ') return `Série DICOMOBJ (${count} fichiers)`
  return `Série DICOM (${count} fichiers)`
}

/** Extrait l'index numérique de IM000042 / DICOMS_IM42 pour tri naturel (IM2 avant IM10). */
export function extractImIndex(storageName: string): number | null {
  const stripped = stripStorageTimestampPrefix(storageName)
  const match = stripped.match(/^(?:DICOMS_)?IM(\d+)(?:\.(?:dcm|dicom))?$/i)
  if (!match) return null
  return Number.parseInt(match[1]!, 10)
}

function compareNamedImagingFiles<T extends NamedImagingFile>(a: T, b: T): number {
  const imA = extractImIndex(a.name)
  const imB = extractImIndex(b.name)
  if (imA !== null && imB !== null && imA !== imB) return imA - imB
  if (imA !== null && imB === null) return -1
  if (imA === null && imB !== null) return 1
  const sizeA = fileSizeBytes(a) ?? 0
  const sizeB = fileSizeBytes(b) ?? 0
  if (a.name === b.name && sizeA !== sizeB) return sizeA - sizeB
  return a.name.localeCompare(b.name)
}

function coefficientOfVariation(sizes: number[]): number {
  if (sizes.length < 2) return 0
  const mean = sizes.reduce((sum, value) => sum + value, 0) / sizes.length
  if (mean <= 0) return 0
  const variance =
    sizes.reduce((sum, value) => sum + (value - mean) ** 2, 0) / sizes.length
  return Math.sqrt(variance) / mean
}

/** Sépare une série plate hétérogène (CD DICOMS_IM*) en lots de tailles compatibles. */
const PATIENT_IM_SPLIT_MIN_FILES = 40
const PATIENT_IM_SPLIT_MIN_CV = 0.12
const SIZE_BAND_GAP_RATIO = 0.35

function clusterBySizeGaps<T extends NamedImagingFile>(files: T[]): T[][] {
  const sorted = [...files].sort(
    (a, b) => (fileSizeBytes(a) ?? 0) - (fileSizeBytes(b) ?? 0),
  )
  const clusters: T[][] = []
  let current: T[] = []

  for (const file of sorted) {
    const size = fileSizeBytes(file) ?? 0
    if (current.length === 0) {
      current.push(file)
      continue
    }
    const refSizes = current
      .map((entry) => fileSizeBytes(entry))
      .filter((value): value is number => value !== null)
    const ref = medianSize(refSizes) ?? size
    const maxRef = Math.max(ref, size)
    if (maxRef > 0 && Math.abs(size - ref) / maxRef > SIZE_BAND_GAP_RATIO) {
      clusters.push(current)
      current = [file]
    } else {
      current.push(file)
    }
  }
  if (current.length > 0) clusters.push(current)
  return clusters
}

/** Évite de démarrer le pool sur une miniature (<90 Ko) ou un volume multi-Mo. */
export function pickPreferredBootstrapIndex<T extends NamedImagingFile>(files: T[]): number {
  const sizes = files
    .map((file) => fileSizeBytes(file))
    .filter((size): size is number => size !== null)
  const median = medianSize(sizes) ?? 200_000

  let bestIndex = 0
  let bestScore = Number.NEGATIVE_INFINITY
  for (let index = 0; index < files.length; index += 1) {
    const size = fileSizeBytes(files[index]!) ?? 0
    if (size < 90_000 || size > 800_000) continue
    const score = -Math.abs(size - median)
    if (score > bestScore) {
      bestScore = score
      bestIndex = index
    }
  }
  if (bestScore > Number.NEGATIVE_INFINITY) return bestIndex

  const nonHuge = files.findIndex((file) => (fileSizeBytes(file) ?? 0) <= 800_000)
  return nonHuge >= 0 ? nonHuge : 0
}

function promoteBootstrapFile<T extends NamedImagingFile>(files: T[]): T[] {
  const index = pickPreferredBootstrapIndex(files)
  if (index <= 0) return files
  return [files[index]!, ...files.slice(0, index), ...files.slice(index + 1)]
}

function sortAndPreparePatientImGroup<T extends NamedImagingFile>(files: T[]): T[] {
  const sorted = [...files].sort(compareNamedImagingFiles)
  return promoteBootstrapFile(sorted)
}

function splitPatientImIfHeterogeneous<T extends NamedImagingFile>(
  files: T[],
): Array<{ groupId: string; files: T[] }> {
  const sizes = files
    .map((file) => fileSizeBytes(file))
    .filter((size): size is number => size !== null)
  if (
    files.length < PATIENT_IM_SPLIT_MIN_FILES ||
    coefficientOfVariation(sizes) < PATIENT_IM_SPLIT_MIN_CV
  ) {
    return [{ groupId: 'patient-im', files: sortAndPreparePatientImGroup(files) }]
  }

  return clusterBySizeGaps(files).map((band, index) => ({
    groupId: `patient-im-band-${index}`,
    files: sortAndPreparePatientImGroup(band),
  }))
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

  for (const [groupId, list] of groups.entries()) {
    if (groupId !== 'patient-im') {
      list.sort((a, b) => a.name.localeCompare(b.name))
    }
  }

  const result: Array<{ groupId: string; files: T[] }> = []
  const orderedIds = [
    ...GROUP_ORDER.filter((id) => groups.has(id)),
    ...Array.from(groups.keys())
      .filter((id) => !GROUP_ORDER.includes(id as (typeof GROUP_ORDER)[number]))
      .sort(),
  ]

  for (const groupId of orderedIds) {
    const list = groups.get(groupId) ?? []
    if (groupId === 'patient-im') {
      result.push(...splitPatientImIfHeterogeneous(list))
    } else {
      result.push({ groupId, files: list })
    }
  }

  return result
}
