/**
 * Import dossier CD DICOM — détection magic bytes, regroupement par série.
 */

import {
  DICOM_MIME_TYPE,
  ensureDicomExtension,
  fileIsLikelyDicom,
  readDicomHeaderFromFile,
  type DicomHeaderInfo,
} from '@/lib/imaging/dicom-detection'
import { fileRelativePath } from '@/lib/imaging/directory-picker'
import { isIgnorableCompanionFile } from '@/lib/documents/patient-documents'
import {
  isNumericFolderPrefix,
  seriesUidFilenamePrefix,
} from '@/lib/imaging/dicom-series-uid-name'

export type PreparedDicomFile = {
  file: File
  seriesInstanceUid: string
  modality: string | null
  originalName: string
  relativePath: string
}

export type DicomImportSeries = {
  seriesInstanceUid: string
  modality: string | null
  label: string
  seriesFolderKey: string | null
  files: PreparedDicomFile[]
}

export type DicomFolderImportResult = {
  series: DicomImportSeries[]
  ignoredCompanionCount: number
  skippedNonDicomCount: number
  scannedCandidateCount: number
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
  return `${base} Exemples non reconnus : ${samples}. Selectionnez le dossier racine du CD (ex. Arcande_IRM) contenant DICOM/ ou SE/IM*.`
}

export function basenameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

function sanitizeBasename(name: string): string {
  const base = basenameFromPath(name)
  const safe = base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200)
  return safe.length > 0 ? safe : 'fichier'
}

export function extractSeriesFolderKey(relativePath: string): string | null {
  const parts = relativePath.split(/[\\/]/).filter(Boolean)
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const part = parts[i]!
    if (/^SE\d+/i.test(part) || /^Series\d*/i.test(part)) {
      return parts.slice(0, i + 1).join('/')
    }
  }
  const base = basenameFromPath(relativePath)
  if (/^IM\d+/i.test(base) && parts.length >= 2) {
    return parts.slice(0, -1).join('/')
  }
  return null
}

export function resolveSeriesKey(header: DicomHeaderInfo | null, relativePath: string): string {
  if (header?.seriesInstanceUid) return header.seriesInstanceUid
  const folderKey = extractSeriesFolderKey(relativePath)
  if (folderKey) return `path:${folderKey}`
  return `path:${relativePath.replace(/[\\/]/g, '/')}`
}

/**
 * Nom upload unique : SE* / Series* en priorité, sinon SUID.{b64}.{stem}.dcm.
 * Ne jamais utiliser un parent purement numérique (ex. 33230000) comme clé série.
 */
export function buildUniqueUploadName(
  relativePath: string,
  originalName: string,
  header?: DicomHeaderInfo | null,
): string {
  const base = sanitizeBasename(originalName)
  const withExt = ensureDicomExtension(base)
  const stem = withExt.replace(/\.(dcm|dicom)$/i, '')

  const folderKey = extractSeriesFolderKey(relativePath)
  if (folderKey) {
    const seriesTag = sanitizeBasename(basenameFromPath(folderKey))
    if (/^SE\d+/i.test(seriesTag) || /^Series\d*/i.test(seriesTag)) {
      return `${seriesTag}_${stem}.dcm`
    }
  }

  if (header?.seriesInstanceUid) {
    const prefix = seriesUidFilenamePrefix(header.seriesInstanceUid)
    const maxStem = Math.max(8, 180 - prefix.length)
    return `${prefix}.${stem.slice(0, maxStem)}.dcm`
  }

  if (folderKey) {
    const seriesTag = sanitizeBasename(basenameFromPath(folderKey))
    if (!isNumericFolderPrefix(seriesTag)) {
      return `${seriesTag}_${stem}.dcm`
    }
  }

  const parts = relativePath.split(/[\\/]/).filter(Boolean)
  if (parts.length >= 2) {
    const parent = sanitizeBasename(parts[parts.length - 2]!)
    if (!isNumericFolderPrefix(parent)) {
      return `${parent}_${withExt}`
    }
  }

  return withExt
}

export function prepareDicomUploadFile(
  original: File,
  relativePath: string,
  header: DicomHeaderInfo | null,
): File {
  const safeName = buildUniqueUploadName(relativePath, original.name, header)
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
  seriesFolderKey?: string | null,
): string {
  const mod = modality?.toUpperCase() ?? null
  const modLabel = mod ? (MODALITY_LABELS[mod] ?? mod) : 'Série DICOM'
  if (seriesFolderKey) {
    const folderName = basenameFromPath(seriesFolderKey)
    return `Série ${folderName} : ${sliceCount} image${sliceCount > 1 ? 's' : ''}${mod ? ` (${modLabel})` : ''}`
  }
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

    const isDicom = await fileIsLikelyDicom(file, displayPath)
    if (!isDicom) {
      skippedNonDicomCount += 1
      if (sampleSkippedPaths.length < 3) sampleSkippedPaths.push(displayPath)
      continue
    }

    const header = await readDicomHeaderFromFile(file)
    const seriesKey = resolveSeriesKey(header, displayPath)

    prepared.push({
      file: prepareDicomUploadFile(file, displayPath, header),
      seriesInstanceUid: seriesKey,
      modality: header?.modality ?? null,
      originalName: file.name,
      relativePath: displayPath,
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
      seriesFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
      const modality = seriesFiles[0]?.modality ?? null
      const seriesFolderKey = extractSeriesFolderKey(seriesFiles[0]?.relativePath ?? '')
      return {
        seriesInstanceUid,
        modality,
        seriesFolderKey,
        label: dicomSeriesImportLabel(modality, index, seriesFiles.length, seriesFolderKey),
        files: seriesFiles,
      }
    },
  )

  series.sort((a, b) => (a.seriesFolderKey ?? a.label).localeCompare(b.seriesFolderKey ?? b.label))

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
