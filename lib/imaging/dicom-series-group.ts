/**
 * Re-export SoT `@franchir/imaging` — ne pas dupliquer la logique ici.
 * Éditer `packages/imaging`, puis `npm run imaging:sync` vers questionnaires.
 */
export {
  dedupeDicomFilesByBasename,
  dicomSeriesGroupId,
  dicomSeriesLabel,
  dicomSeriesSourceLabel,
  extractImIndex,
  groupDicomFilesByMetadata,
  groupDicomFilesIntoSeries,
  isEncapsulatedPdfGroupId,
  pickPreferredBootstrapIndex,
  stripStorageTimestampPrefix,
  type DicomMetaSeriesGroup,
  type MetaImagingFile,
  type NamedImagingFile,
} from '@franchir/imaging'
