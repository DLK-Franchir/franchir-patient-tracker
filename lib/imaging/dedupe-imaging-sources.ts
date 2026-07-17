/**
 * Déduplication imagerie tracker ↔ questionnaire (forward patient-images).
 *
 * Marcel voit les deux sources : sans filtre, le même Study DICOM apparaît
 * deux fois (~20 séries au lieu de ~10) et les JPEG forwardés se doublonnent
 * avec le badge « Via questionnaire patient ».
 */

import { isNumericFolderPrefix } from '@/lib/imaging/dicom-series-uid-name'

export type TrackerImagingRef = {
  fileName: string
  renderType: 'dicom' | 'pdf' | 'image' | 'video' | 'other'
  sizeBytes?: number | null
  seriesInstanceUid?: string | null
  sopInstanceUid?: string | null
}

export type QuestionnaireImagingRef = {
  name: string
  type: 'image' | 'pdf' | 'dicom' | 'video'
  size?: number | null
  seriesInstanceUid?: string | null
  sopInstanceUid?: string | null
}

/** Retire timestamps d'upload et préfixes dossier PACS numériques (33230000_…). */
export function stripImagingStoragePrefixes(storageName: string): string {
  let base = storageName.split('/').pop() ?? storageName
  while (true) {
    // Underscore only — ne pas matcher le point d'extension (55618353.dcm).
    const match = base.match(/^(\d+)_(.+)$/)
    if (!match) break
    const prefix = match[1]!
    const rest = match[2]!
    // Timestamp upload (≥10 chiffres) ou dossier étude PACS purement numérique.
    if (prefix.length >= 10 || isNumericFolderPrefix(prefix)) {
      base = rest
      continue
    }
    break
  }
  return base
}

/** Clé de comparaison souple (espaces / underscores / casse). */
export function normalizeImagingBasename(storageName: string): string {
  return stripImagingStoragePrefixes(storageName)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[_\s]+/g, '_')
    .replace(/_+/g, '_')
}

function trackerDicomKeys(docs: TrackerImagingRef[]) {
  const seriesUids = new Set<string>()
  const sopUids = new Set<string>()
  const basenames = new Set<string>()

  for (const doc of docs) {
    if (doc.renderType !== 'dicom') continue
    const suid = doc.seriesInstanceUid?.trim()
    if (suid) seriesUids.add(suid)
    const sop = doc.sopInstanceUid?.trim()
    if (sop) sopUids.add(sop)
    basenames.add(normalizeImagingBasename(doc.fileName))
  }

  return { seriesUids, sopUids, basenames }
}

function trackerNonDicomKeys(docs: TrackerImagingRef[]) {
  const basenames = new Set<string>()
  const sizeByBase = new Map<string, Set<number>>()

  for (const doc of docs) {
    if (doc.renderType === 'dicom') continue
    const base = normalizeImagingBasename(doc.fileName)
    basenames.add(base)
    const size = typeof doc.sizeBytes === 'number' && doc.sizeBytes > 0 ? doc.sizeBytes : null
    if (size !== null) {
      const set = sizeByBase.get(base) ?? new Set<number>()
      set.add(size)
      sizeByBase.set(base, set)
    }
  }

  return { basenames, sizeByBase }
}

function isQuestionnaireDicomDuplicate(
  file: QuestionnaireImagingRef,
  keys: ReturnType<typeof trackerDicomKeys>,
): boolean {
  const suid = file.seriesInstanceUid?.trim()
  if (suid && keys.seriesUids.has(suid)) return true
  const sop = file.sopInstanceUid?.trim()
  if (sop && keys.sopUids.has(sop)) return true
  return keys.basenames.has(normalizeImagingBasename(file.name))
}

function isQuestionnaireFileDuplicate(
  file: QuestionnaireImagingRef,
  keys: ReturnType<typeof trackerNonDicomKeys>,
): boolean {
  const base = normalizeImagingBasename(file.name)
  if (keys.basenames.has(base)) return true

  // Forward parfois renomme espaces → underscores : déjà couvert par normalize.
  // Repli taille si le stem racine (sans suffixe _1-1) coincide.
  const size = typeof file.size === 'number' && file.size > 0 ? file.size : null
  if (size === null) return false
  for (const [trackerBase, sizes] of keys.sizeByBase) {
    if (!sizes.has(size)) continue
    if (trackerBase === base) return true
  }
  return false
}

/**
 * Garde uniquement l'imagerie questionnaire absente du tracker.
 * Source de vérité affichage = documents tracker quand le même Study/fichier
 * a été forwardé vers patient-images.
 */
export function filterQuestionnaireImagingAgainstTracker<T extends QuestionnaireImagingRef>(
  trackerDocs: TrackerImagingRef[],
  questionnaireFiles: T[],
): T[] {
  if (questionnaireFiles.length === 0) return questionnaireFiles
  if (trackerDocs.length === 0) return questionnaireFiles

  const dicomKeys = trackerDicomKeys(trackerDocs)
  const otherKeys = trackerNonDicomKeys(trackerDocs)
  const seenQ = new Set<string>()

  return questionnaireFiles.filter((file) => {
    if (file.type === 'dicom') {
      if (isQuestionnaireDicomDuplicate(file, dicomKeys)) return false
    } else if (isQuestionnaireFileDuplicate(file, otherKeys)) {
      return false
    }

    // Dédup interne Q (forward double / re-upload).
    const selfKey = `${file.type}:${normalizeImagingBasename(file.name)}:${file.size ?? ''}:${file.sopInstanceUid ?? ''}`
    if (seenQ.has(selfKey)) return false
    seenQ.add(selfKey)
    return true
  })
}
