/**
 * Résout les métadonnées DICOM à écrire dans patient_documents au finalize.
 * Priorité : payload client → SeriesInstanceUID encodé dans le nom Storage.
 */

import type { DicomMetadataInput } from '@/lib/documents/patient-documents'
import { extractSeriesUidFromStorageName } from '@/lib/imaging/dicom-series-uid-name'

export type ResolvedDicomPersistMeta = {
  sopInstanceUid: string | null
  seriesInstanceUid: string | null
  seriesDescription: string | null
  bodyPart: string | null
  instanceNumber: number | null
  acquisitionDatetime: string | null
}

export function resolveDicomPersistMeta(
  fileName: string,
  dicom: DicomMetadataInput | null | undefined,
): ResolvedDicomPersistMeta | null {
  const fromName = extractSeriesUidFromStorageName(fileName)
  const sop = dicom?.sopInstanceUid ?? null
  const series = dicom?.seriesInstanceUid?.trim() || fromName || null
  const seriesDescription = dicom?.seriesDescription ?? null
  const bodyPart = dicom?.bodyPart ?? null
  const instanceNumber = dicom?.instanceNumber ?? null
  const acquisitionDatetime = dicom?.acquisitionDatetime ?? null

  if (
    !sop &&
    !series &&
    !seriesDescription &&
    !bodyPart &&
    instanceNumber == null &&
    !acquisitionDatetime
  ) {
    return null
  }

  return {
    sopInstanceUid: sop,
    seriesInstanceUid: series,
    seriesDescription,
    bodyPart,
    instanceNumber,
    acquisitionDatetime,
  }
}
