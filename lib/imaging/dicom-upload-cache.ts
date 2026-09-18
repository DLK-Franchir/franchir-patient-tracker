import type { DicomPersistedMetadata } from '@/lib/imaging/dicom-content'

const cache = new WeakMap<File, DicomPersistedMetadata>()

export function cachePreparedDicomMeta(file: File, meta: DicomPersistedMetadata): void {
  cache.set(file, meta)
}

export function getPreparedDicomMeta(file: File): DicomPersistedMetadata | undefined {
  return cache.get(file)
}
