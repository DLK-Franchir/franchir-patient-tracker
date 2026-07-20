# Imaging telemetry (P3a) — non-PHI product metrics

Client-safe observability for blank-canvas / slow-open regressions. Package emits;
apps forward to existing analytics (gtag / plausible).

## Contract

| Item | Location |
|------|----------|
| Event shapes + validators | `@franchir/imaging-viewer` → `telemetry.ts` |
| Host callback | `onImagingTelemetry?.(event)` on `DicomViewer` + OpenJPEG fallback |
| Tracker adapter | `lib/imaging/report-imaging-telemetry.ts` |
| Q adapter | `src/lib/imaging/report-imaging-telemetry.ts` (after sync) |

**Never include:** patient id/name/email, series labels, signed URLs, storage paths, raw dwv error strings.

## Events

| `name` | When | Key props |
|--------|------|-----------|
| `time_to_first_paint` | First `status === 'ready'` (dwv or OpenJPEG) | `duration_ms`, `engine`, `nav_mode`, `file_count` |
| `series_open_ms` | First terminal ready/error for a series open | `duration_ms`, `outcome`, `engine` |
| `openjpeg_fallback` | dwv unsupported JPEG 2000 → app switches to OpenJPEG | `reason=unsupported_j2k` |
| `ready_without_pixels` | Geometry present, pixel buffer empty/uniform (blank canvas gate) | `reason=empty_pixel_buffer` |
| `worker_asset_fail` | Load error looks like worker script failure | `reason=worker_script` |
| `dicom_export` | ZIP série / étude (single ou multi-parties) | `duration_ms`, `file_count`, `outcome`, `reason` (`series`, `study_single`, `study_chunked`, `*_fail`) |

Analytics event name in apps: `imaging_<name>` (e.g. `imaging_time_to_first_paint`).

## Wiring

```tsx
import { reportImagingTelemetry } from '@/lib/imaging/report-imaging-telemetry'

<DicomViewer … onImagingTelemetry={reportImagingTelemetry} />
<DicomJpeg2000FallbackViewer … onImagingTelemetry={reportImagingTelemetry} />
```

Package stays vendor-agnostic — only the optional callback.

## Alerts (product)

| Signal | Suspect |
|--------|---------|
| Spike `ready_without_pixels` / `worker_asset_fail` | Worker rewrite `/_next/.../assets/workers` → `/dwv-workers` broken (see `proxy.ts`) |
| Spike `openjpeg_fallback` | COD / J2K path — expected for some DX; watch OpenJPEG TTFP |
| High p95 `time_to_first_paint` / `series_open_ms` | Slow signed URL / decode / pool bootstrap |

See also `PRODUCT.md` (package) and `IMAGING_ADAPTERS.md` (listing / TTL).
