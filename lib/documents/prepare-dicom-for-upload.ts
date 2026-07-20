/**
 * Prépare un fichier avant sign-upload / finalize : extrait les métadonnées
 * DICOM persistables et encode SeriesInstanceUID dans le nom (SUID.*) quand
 * le chemin CD n offre pas deja un prefixe SE / Series.
 *
 * Objectif P3b : chaque nouvel upload ecrit series_instance_uid en DB et
 * forward un nom decodable cote questionnaires sans Range enrich.
 */

import { inferRenderType } from '@/lib/documents/patient-documents'
import {
  extractDicomPersistedMetadata,
  type DicomPersistedMetadata,
} from '@/lib/imaging/dicom-content'
import { DICOM_HEADER_SCAN_BYTES } from '@/lib/imaging/dicom-detection'
import { prepareDicomUploadFile } from '@/lib/imaging/dicom-folder-import'
import { extractSeriesUidFromStorageName } from '@/lib/imaging/dicom-series-uid-name'

export type PreparedUploadFile = {
  file: File
  dicom: DicomPersistedMetadata | null
}

async function readPersistedMeta(file: File): Promise<DicomPersistedMetadata | null> {
  if (inferRenderType(file.name, file.type) !== 'dicom') return null
  try {
    const head = file.slice(0, Math.min(file.size, DICOM_HEADER_SCAN_BYTES))
    const buffer = await head.arrayBuffer()
    return extractDicomPersistedMetadata(buffer)
  } catch {
    return null
  }
}

/**
 * Si le fichier est DICOM avec SeriesInstanceUID et que le nom ne l'encode
 * pas encore, renomme via prepareDicomUploadFile (parité import dossier).
 */
export async function prepareDicomForUpload(file: File): Promise<PreparedUploadFile> {
  const dicom = await readPersistedMeta(file)
  if (!dicom?.seriesInstanceUid) {
    return { file, dicom }
  }

  if (extractSeriesUidFromStorageName(file.name)) {
    return { file, dicom }
  }

  const prepared = prepareDicomUploadFile(file, file.name, {
    seriesInstanceUid: dicom.seriesInstanceUid,
    modality: null,
    sopInstanceUid: dicom.sopInstanceUid,
  })
  return { file: prepared, dicom }
}

export async function prepareDicomFilesForUpload(files: File[]): Promise<PreparedUploadFile[]> {
  return Promise.all(files.map((f) => prepareDicomForUpload(f)))
}
