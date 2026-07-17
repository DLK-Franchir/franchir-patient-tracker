/**
 * @franchir/imaging — primitives partagées imagerie (grouping séries DICOM).
 * SoT = franchir-patient-tracker. Sync → questionnaires via `npm run imaging:sync`.
 */

export {
  ENCAPSULATED_PDF_BAND_MAX_BYTES,
  isLikelyEncapsulatedPdfBand,
} from './dicom-pdf-band'

export {
  extractSeriesUidFromStorageName,
  isNumericFolderPrefix,
  seriesUidFilenamePrefix,
} from './dicom-series-uid-name'

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
} from './dicom-series-group'

export {
  filterQuestionnaireImagingAgainstTracker,
  normalizeImagingBasename,
  stripImagingStoragePrefixes,
  type QuestionnaireImagingRef,
  type TrackerImagingRef,
} from './dedupe-imaging-sources'
