# Imaging telemetry (P3a → P8) — non-PHI product metrics

Client-safe observability for blank-canvas / slow-open / export regressions.
Package emits; apps forward to existing analytics (gtag / Plausible).

P8 makes the contract **actionable**: how to read dashboards, numeric alert
thresholds, reserved `dicom_export` reasons for P7 async ZIP, and a
machine-readable summary endpoint (no live PHI counters).

## Contract

| Item | Location |
|------|----------|
| Event shapes + validators | `@franchir/imaging-viewer` → `telemetry.ts` |
| Export reasons (sync + async reserved) | `DICOM_EXPORT_REASONS` |
| Alert thresholds | `IMAGING_TELEMETRY_ALERT_THRESHOLDS` |
| Contract summary helper | `buildImagingTelemetryContractSummary()` |
| Host callback | `onImagingTelemetry?.(event)` on `DicomViewer` + OpenJPEG fallback |
| Tracker adapter | `lib/imaging/report-imaging-telemetry.ts` |
| Q adapter | `src/lib/imaging/report-imaging-telemetry.ts` (after sync) |
| Ops summary API (tracker) | `GET /api/internal/imaging/telemetry-summary` |

**Never include:** patient id/name/email, series labels, signed URLs, storage paths, raw dwv error strings.

## Events

| `name` | When | Key props |
|--------|------|-----------|
| `time_to_first_paint` | First `status === 'ready'` (dwv or OpenJPEG) | `duration_ms`, `engine`, `nav_mode`, `file_count` |
| `series_open_ms` | First terminal ready/error for a series open | `duration_ms`, `outcome`, `engine` |
| `openjpeg_fallback` | dwv unsupported JPEG 2000 → app switches to OpenJPEG | `reason=unsupported_j2k` |
| `ready_without_pixels` | Geometry present, pixel buffer empty/uniform (blank canvas gate) | `reason=empty_pixel_buffer` |
| `worker_asset_fail` | Load error looks like worker script failure | `reason=worker_script` |
| `dicom_export` | ZIP série / étude (single, multi-parties, **async réservé P7**) | `duration_ms`, `file_count`, `outcome`, `reason` |

Analytics event name in apps: `imaging_<name>` (e.g. `imaging_time_to_first_paint`).
Constant: `IMAGING_TELEMETRY_ANALYTICS_PREFIX` = `imaging_`.

### `dicom_export` reasons

| `reason` | Lane | Meaning |
|----------|------|---------|
| `series` / `series_fail` | P5 sync | ZIP série |
| `study_single` / `study_single_fail` | P5 sync | ZIP étude une partie |
| `study_chunked` / `study_chunk_fail` | P5 sync | ZIP étude multi-parties (`?part=N`) |
| `study_plan_fail` / `study_download_fail` | P5 sync | Plan / fetch générique |
| `study_async` / `study_async_fail` / `study_async_timeout` | **P7 reserved** | Job Storage / download async — **same event name**, do not invent `imaging_async_zip` |

P8 does **not** implement async ZIP or MP4. P7 must emit `dicom_export` with the reserved reasons above.

## Wiring

```tsx
import { reportImagingTelemetry } from '@/lib/imaging/report-imaging-telemetry'

<DicomViewer … onImagingTelemetry={reportImagingTelemetry} />
<DicomJpeg2000FallbackViewer … onImagingTelemetry={reportImagingTelemetry} />
```

Package stays vendor-agnostic — only the optional callback.

## How to see events (gtag / Plausible)

### Google Analytics 4 (gtag)

1. Confirm `NEXT_PUBLIC_GA_ID` is set on the Vercel project (Marcel /
   clinicien).
2. Open a series in staging/prod → DevTools Network : look for
   `collect?…` / `g/collect` with event name `imaging_*`.
3. In GA4 UI :
   - **Reports → Engagement → Events** — filter `imaging_`
   - Or **Explore → Free form** : dimension `Event name`, filter
     `imaging_ready_without_pixels`, `imaging_worker_asset_fail`,
     `imaging_dicom_export`, …
4. Custom dimensions / params (if registered) : `duration_ms`, `outcome`,
   `reason`, `engine`, `nav_mode`, `file_count` — scalars only.
5. Dev : console `[ImagingTelemetry] imaging_…` when `NODE_ENV=development`.

### Plausible

1. Confirm Plausible snippet + `window.plausible` on the host.
2. **Site → Goal Conversions** (or custom events) — events are sent as
   `imaging_<name>` with props object.
3. Props appear as custom properties when the Plausible plan supports them
   (`duration_ms`, `reason`, `outcome`, …).
4. Same DevTools check : XHR/beacon to Plausible with the event name.

### Smoke checklist (no PHI in tickets)

- [ ] Open one series → expect `imaging_time_to_first_paint` + `imaging_series_open_ms`
- [ ] Fatima-like J2K → may see `imaging_openjpeg_fallback` (expected)
- [ ] Export série → `imaging_dicom_export` `reason=series` `outcome=ready`
- [ ] Never paste signed URLs / patient ids into analytics tickets

## Alert thresholds (P8)

Window: ~1 h rolling prod (Marcel + clinicien). Apply rate / p95 only when
`sample_count >= minSamplesForRateOrP95` (default **20**).

| Signal | Threshold | Suspect |
|--------|-----------|---------|
| `imaging_ready_without_pixels` count / h | **≥ 5** | Blank-canvas gate firing — workers / decode |
| `imaging_worker_asset_fail` count / h | **≥ 3** | Rewrite `/_next/.../assets/workers` → `/dwv-workers` broken (`proxy.ts`) |
| `imaging_dicom_export` with `outcome=error` rate | **≥ 20%** | Study ZIP chunked / Storage stream / (later) async job |
| p95 `imaging_time_to_first_paint` `duration_ms` | **≥ 15_000** | Signed URL / decode / OpenJPEG path |
| p95 `imaging_series_open_ms` `duration_ms` | **≥ 30_000** | Pool bootstrap / sequential load |

Source of truth in code: `IMAGING_TELEMETRY_ALERT_THRESHOLDS` (package).

### Quick triage

| Signal | Suspect |
|--------|---------|
| Spike `ready_without_pixels` / `worker_asset_fail` | Worker rewrite broken (see `proxy.ts` + Fatima J2K) |
| Spike `openjpeg_fallback` | COD / J2K path — expected for some DX; watch OpenJPEG TTFP |
| High p95 TTFP / series open | Slow signed URL / decode / pool |
| `dicom_export` failures `study_chunk_*` | Chunked ZIP path (P5) |
| `dicom_export` failures `study_async*` | P7 async job lane (when landed) |

## Internal summary API (tracker)

```http
GET /api/internal/imaging/telemetry-summary
Authorization: Bearer <TRACKER_SYNC_SERVICE_TOKEN|TRACKER_RETURN_TOKEN>
```

Returns the **contract** (event names, reasons, thresholds, analytics prefix) —
**not** live GA/Plausible aggregates (no PHI store on our side).

Use for smoke / runbooks / verifying pin parity after deploy. Response
includes `analyticsConfigured` (presence of `NEXT_PUBLIC_GA_ID` and/or
Plausible domain env if set) without leaking secrets.

```bash
curl -sS -H "Authorization: Bearer $TRACKER_SYNC_SERVICE_TOKEN" \
  https://patients.franchir.eu/api/internal/imaging/telemetry-summary | jq .
```

## Related

- Package `PRODUCT.md` (P8 section)
- `IMAGING_ADAPTERS.md` (listing / TTL)
- `IMAGING_RUNBOOK.md` / `IMAGING_STABILIZE.md` (post-deploy glance)
