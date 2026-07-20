import { describe, expect, it } from 'vitest'
import * as pkg from '@franchir/imaging-viewer'
import * as ui from '@franchir/imaging-viewer/ui'
import * as workerRewrite from '@franchir/imaging-viewer/worker-rewrite'
import { formatDicomLoadError } from '@/components/patient/dicom-viewer'
import { DicomViewer } from '@/components/patient/dicom-viewer'
import {
  DicomEncapsulatedPdfViewer,
} from '@/components/patient/dicom-encapsulated-pdf-viewer'
import {
  DicomJpeg2000FallbackViewer,
} from '@/components/patient/dicom-jpeg2000-fallback-viewer'
import {
  dwvWorkerRewriteTarget,
  OPENJPEG_SCRIPT_URL,
} from '@/lib/imaging/dwv-worker-rewrite'
import { getAppViewerCapabilities } from '@/lib/imaging/viewer-capabilities'

describe('imaging-viewer intentional adapters (tracker)', () => {
  it('host / PDF / OpenJPEG adapters pointent sur /ui', () => {
    expect(DicomViewer).toBe(ui.DicomViewer)
    expect(DicomEncapsulatedPdfViewer).toBe(ui.DicomEncapsulatedPdfViewer)
    expect(DicomJpeg2000FallbackViewer).toBe(ui.DicomJpeg2000FallbackViewer)
    expect(formatDicomLoadError).toBe(pkg.formatDicomLoadError)
  })

  it('worker-rewrite adapter aligne le SoT', () => {
    expect(dwvWorkerRewriteTarget).toBe(workerRewrite.dwvWorkerRewriteTarget)
    expect(OPENJPEG_SCRIPT_URL).toBe(workerRewrite.OPENJPEG_SCRIPT_URL)
  })

  it('capabilities adapter expose openjpeg / pdf / mp4', () => {
    const caps = getAppViewerCapabilities()
    expect(caps.jpeg2000OpenJpegFallback).toBe(true)
    expect(caps.encapsulatedPdf).toBe(true)
    expect(typeof caps.mp4Native).toBe('boolean')
    expect(caps.maxSequentialPool).toBe(pkg.MAX_SEQUENTIAL_POOL)
  })
})
