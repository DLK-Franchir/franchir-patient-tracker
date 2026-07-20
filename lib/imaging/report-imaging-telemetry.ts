/**
 * Adapter analytics Imaging — branche `onImagingTelemetry` du package
 * vers gtag / plausible (props scalaires, sans PHI / sans URL).
 */

import {
  imagingTelemetryAnalyticsEventName,
  imagingTelemetryToAnalyticsProps,
  type ImagingTelemetryEvent,
  type ImagingTelemetryHandler,
} from '@franchir/imaging-viewer'

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    plausible?: (event: string, options?: { props?: Record<string, string | number> }) => void
  }
}

/** Handler prêt à passer à `DicomViewer` / `DicomJpeg2000FallbackViewer`. */
export const reportImagingTelemetry: ImagingTelemetryHandler = (event) => {
  const props = imagingTelemetryToAnalyticsProps(event)
  const eventName = imagingTelemetryAnalyticsEventName(event.name)

  if (typeof window === 'undefined') return

  if (window.gtag) {
    window.gtag('event', eventName, props)
  }
  if (window.plausible) {
    window.plausible(eventName, { props })
  }
  if (process.env.NODE_ENV === 'development') {
    console.log('[ImagingTelemetry]', eventName, props)
  }
}

/** Re-export type pour les call-sites typés. */
export type { ImagingTelemetryEvent }
