'use client'

/**
 * Adapter mince — host dwv SoT `@franchir/imaging-viewer/ui`.
 * Éditer le package, puis `npm run imaging-viewer:sync`.
 */

export {
  DicomViewer as default,
  DicomViewer,
  type DicomViewerProps,
} from '@franchir/imaging-viewer/ui'

export type { ViewerSeries } from '@franchir/imaging-viewer'
export { formatDicomLoadError } from '@franchir/imaging-viewer'
