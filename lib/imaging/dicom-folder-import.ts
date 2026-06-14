/**
 * Import dossier CD DICOM — détection magic bytes, regroupement par série.
 */

import {
  DICOM_MIME_TYPE,
  ensureDicomExtension,
  fileHasDicomPreamble,
  readDicomHeaderFromFile,
  type DicomHeaderInfo,
} from '@/lib/imaging/dicom-detection'
import { fileRelativePath } from '@/lib/imaging/directory-picker'
import { isIgnorableCompanionFile } from '@/lib/documents/patient-documents'

export type PreparedDicomFile = {
  file: File
  seriesInstanceUid: string
  modality: string | null
  originalName: string
}

export type DicomImportSeries = {
  seriesInstanceUid: string
  modality: string | null
  label: string
  files: PreparedDicomFile[]
}

export type DicomFolderImportResult = {
  series: DicomImportSeries[]
  ignoredCompanionCount: number
  skippedNonDicomCount: number
  /** Nombre de fichiers parcourus (hors parasites). */
  scannedCandidateCount: number
  /** Exemples de chemins non reconnus (diagnostic UX). */
  sampleSkippedPaths: string[]
}

export function formatEmptyDicomFolderMessage(result: DicomFolderImportResult): string {
  const base = 'Aucune image DICOM reconnue dans ce dossier.'
  if (result.scannedCandidateCount === 0) {
    return `${base} Le dossier semble vide ou ne contient que des fichiers systeme (DICOMDIR, autorun…).`
  }
  if (result.sampleSkippedPaths.length === 0) {
    return `${base} ${result.skippedNonDicomCount} fichier(s) analyse(s) sans en-tete DICOM valide.`
  }
  const samples = result.sampleSkippedPaths.slice(0, 3).join(', ')
  return `${base} Exemples non reconnus : ${samples}. Selectionnez le dossier racine du CD (ex. Arcande_IRM) contenant DICOM/ ou SE*/IM*.`
}

export function basenameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

function sanitizeBasename(name: string): string {
  const base = basenameFromPath(name)
  const safe = base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200)
  return safe.length > 0 ? safe : 'fichier'
}

export function prepareDicomUploadFile(original: File, _header: DicomHeaderInfo): File {
  const safeName = ensureDicomExtension(sanitizeBasename(original.name))
  const blob = original.slice(0, original.size, DICOM_MIME_TYPE)
  return new File([blob], safeName, {
    type: DICOM_MIME_TYPE,
    lastModified: original.lastModified,
  })
}

const MODALITY_LABELS: Record<string, string> = {
  MR: 'IRM',
  CT: 'Scanner',
  CR: 'Radiographie',
  DX: 'Radiographie',
  US: 'Échographie',
  XA: 'Angiographie',
  NM: 'Médecine nucléaire',
  PT: 'TEP',
}

export function dicomSeriesImportLabel(
  modality: string | null,
  seriesIndex: number,
  sliceCount: number,
): string {
  const mod = modality?.toUpperCase() ?? null
  const modLabel = mod ? (MODALITY_LABELS[mod] ?? mod) : 'Série DICOM'
  return `${modLabel} ${seriesIndex + 1} (${sliceCount} image${sliceCount > 1 ? 's' : ''})`
}

export async function importDicomFolder(input: FileList | File[]): Promise<DicomFolderImportResult> {
  const files = Array.from(input)
  let ignoredCompanionCount = 0
  let skippedNonDicomCount = 0
  let scannedCandidateCount = 0
  const sampleSkippedPaths: string[] = []

  const prepared: PreparedDicomFile[] = []

  for (const file of files) {
    const displayPath = fileRelativePath(file)
    if (isIgnorableCompanionFile(displayPath) || isIgnorableCompanionFile(file.name)) {
      ignoredCompanionCount += 1
      continue
    }

    scannedCandidateCount += 1

    const isDicom = await fileHasDicomPreamble(file)
    if (!isDicom) {
      skippedNonDicomCount += 1
      if (sampleSkippedPaths.length < 5) sampleSkippedPaths.push(displayPath)
      continue
    }

    const header = await readDicomHeaderFromFile(file)
    if (!header) {
      skippedNonDicomCount += 1
      if (sampleSkippedPaths.length < 5) sampleSkippedPaths.push(displayPath)
      continue
    }

    prepared.push({
      file: prepareDicomUploadFile(file, header),
      seriesInstanceUid: header.seriesInstanceUid,
      modality: header.modality,
      originalName: file.name,
    })
  }

  const bySeries = new Map<string, PreparedDicomFile[]>()
  for (const item of prepared) {
    const list = bySeries.get(item.seriesInstanceUid) ?? []
    list.push(item)
    bySeries.set(item.seriesInstanceUid, list)
  }

  const series: DicomImportSeries[] = Array.from(bySeries.entries()).map(
    ([seriesInstanceUid, seriesFiles], index) => {
      seriesFiles.sort((a, b) => a.file.name.localeCompare(b.file.name))
      const modality = seriesFiles[0]?.modality ?? null
      return {
        seriesInstanceUid,
        modality,
        label: dicomSeriesImportLabel(modality, index, seriesFiles.length),
        files: seriesFiles,
      }
    },
  )

  return {
    series,
    ignoredCompanionCount,
    skippedNonDicomCount,
    scannedCandidateCount,
    sampleSkippedPaths,
  }
}

export function flattenDicomImportSeries(result: DicomFolderImportResult): PreparedDicomFile[] {
  return result.series.flatMap((s) => s.files)
}
