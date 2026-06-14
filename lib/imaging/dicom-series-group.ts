/**
 * Regroupe les fichiers DICOM listés depuis Storage en séries distinctes.
 * Voir le pendant côté portail questionnaires (`dicom-series-group.ts`).
 */

export type NamedImagingFile = {
  name: string;
  url: string;
};

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
  if (/^IM\d+/i.test(stripped)) return 'patient-im'
  if (/^0+\d+\.(dcm|dicom)$/i.test(stripped)) return 'marcel-cd'
  const stem = stripped.replace(/\.(dcm|dicom)$/i, '')
  return `series:${stem.replace(/\d+$/, '') || stripped}`
}

export function dedupeDicomFilesByBasename<T extends { name: string }>(files: T[]): T[] {
  const best = new Map<string, T>()
  for (const file of files) {
    const base = stripStorageTimestampPrefix(file.name)
    const previous = best.get(base)
    if (!previous || storageTimestampPrefix(file.name) >= storageTimestampPrefix(previous.name)) {
      best.set(base, file)
    }
  }
  return Array.from(best.values()).sort((a, b) => a.name.localeCompare(b.name))
}

export function dicomSeriesLabel(groupId: string, count: number, singleName: string): string {
  if (count <= 1) return singleName
  if (groupId === 'patient-im') return `Série DICOM patient (${count} coupes)`
  return `Série DICOM (${count} coupes)`
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
    ...Array.from(groups.keys()).filter(
      (id) => !GROUP_ORDER.includes(id as (typeof GROUP_ORDER)[number]),
    ),
  ]

  return orderedIds.map((groupId) => ({
    groupId,
    files: groups.get(groupId) ?? [],
  }))
}
