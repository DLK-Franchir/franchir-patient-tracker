/**
 * @franchir/imaging-viewer/ui — shell React + host dwv + PDF DOC + fallback OpenJPEG.
 * Import client-only. Barrel `.` et `/engine` restent sans ce chrome.
 */

export {
  VIEWER_ACCENT,
  VIEWER_BG,
  viewerMobileHint,
  viewerToolHint,
  viewportLoadingMessage,
} from './messages'

export { ViewerInfoBubble, type ViewerInfoBubbleProps } from './viewer-info-bubble'
export {
  DicomViewportErrorOverlay,
  DicomViewportLoadingOverlay,
} from './viewer-overlays'
export {
  DicomSeriesHeader,
  type DicomSeriesHeaderProps,
} from './viewer-series-header'
export {
  DicomViewerToolbar,
  type DicomViewerToolbarProps,
} from './viewer-toolbar'
export {
  DicomJpeg2000FallbackViewer,
  type DicomJpeg2000FallbackViewerProps,
} from './jpeg2000-fallback-viewer'
export {
  DicomEncapsulatedPdfViewer,
  type DicomEncapsulatedPdfViewerProps,
} from './dicom-encapsulated-pdf-viewer'
export { DicomViewer, type DicomViewerProps } from './dicom-viewer'
export { useDwvViewportResize } from './use-dwv-viewport-resize'

export {
  ImagingCardActionMenu,
  type ImagingCardActionMenuProps,
} from './imaging-card-action-menu'
export {
  ImagingDownloadScopeDialog,
  type ImagingDownloadScope,
  type ImagingDownloadScopeDialogProps,
} from './imaging-download-scope-dialog'
export {
  ImagingDeleteConfirmDialog,
  type ImagingDeleteConfirmDialogProps,
} from './imaging-delete-confirm-dialog'
export {
  ImagingGridEmptyState,
  ImagingGridLoadingState,
  type ImagingGridEmptyStateProps,
  type ImagingGridLoadingStateProps,
} from './imaging-grid-states'
export {
  ImagingDownloadStatus,
  type ImagingDownloadStatusProps,
} from './imaging-download-status'
export {
  seriesDownloadProgressMessage,
  studyChunkedSuccessMessage,
  studyDownloadProgressMessage,
  studyTooLargeFallbackMessage,
  type ExportProgressLike,
} from './export-messages'

export {
  autoWindowLevel,
  grayPixelsToRgba,
  parseDicomNumber,
  pixelRange,
  resolveInitialWindowLevel,
  windowValueToGray,
  type WindowLevel,
} from './decode/dicom-windowing'
export { decodeJpeg2000, type DecodedFrame } from './decode/jpeg2000-decode'
export {
  JPEG2000_TRANSFER_SYNTAXES,
  parseDicomForFallback,
  type DicomFallbackData,
} from './decode/dicom-j2k-extract'
