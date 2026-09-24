'use client'

/**
 * Entrée contrat `DicomViewer` — choisit le moteur selon
 * `capabilities.engine` (U1) :
 * - `dwv` (défaut) : host historique (`DicomViewerDwv`).
 * - `cornerstone` : host Cornerstone3D chargé en dynamic import (le chunk
 *   Cornerstone n'est jamais téléchargé quand le moteur reste dwv). En cas
 *   d'échec de chargement / init, repli dwv silencieux (télémétrie `outcome:
 *   fallback`).
 */

import {
  Component,
  Suspense,
  lazy,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from 'react'
import type { DicomViewerProps } from '../contract'
import { resolveViewerCapabilities } from '../policy'
import { emitImagingTelemetry } from '../telemetry'
import { DicomViewerDwv } from './dicom-viewer-dwv'
import { DicomViewportLoadingOverlay } from './viewer-overlays'
import { VIEWER_BG } from './messages'

export type { DicomViewerProps }

const LazyCornerstoneViewer = lazy(() =>
  import('./dicom-viewer-cs').then(mod => ({ default: mod.DicomViewerCornerstone }))
) as ComponentType<DicomViewerProps>

type BoundaryProps = {
  props: DicomViewerProps
  children: ReactNode
}
type BoundaryState = { failed: boolean }

class CornerstoneBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false }

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[DicomViewer] moteur Cornerstone indisponible — repli dwv', error.message, info)
    emitImagingTelemetry(this.props.props.onImagingTelemetry, {
      name: 'series_open_ms',
      durationMs: 0,
      navMode: 'stack',
      fileCount: this.props.props.urls.length,
      engine: 'cornerstone',
      outcome: 'fallback',
      reason: 'engine_unavailable',
    })
  }

  render() {
    if (this.state.failed) {
      return <DicomViewerDwv {...this.props.props} />
    }
    return this.props.children
  }
}

function EngineLoading({ name }: { name: string }) {
  return (
    <div
      className="relative flex h-full min-h-[240px] w-full flex-1"
      style={{ backgroundColor: VIEWER_BG }}
      data-testid="dicom-viewer-root"
      aria-label={`Visionneuse DICOM : ${name}`}
    >
      <DicomViewportLoadingOverlay message="Chargement de la visionneuse…" />
    </div>
  )
}

export function DicomViewer(props: DicomViewerProps) {
  const capabilities = resolveViewerCapabilities(props.capabilities)
  if (capabilities.engine !== 'cornerstone') {
    return <DicomViewerDwv {...props} />
  }
  return (
    <CornerstoneBoundary props={props}>
      <Suspense fallback={<EngineLoading name={props.name} />}>
        <LazyCornerstoneViewer {...props} />
      </Suspense>
    </CornerstoneBoundary>
  )
}

export default DicomViewer
