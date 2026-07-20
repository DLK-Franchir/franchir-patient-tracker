# Imaging stabilize — Phase A checklist

Post-merge consolidation for Franchir Imaging (tracker SoT ↔ clinicien pin).
No PHI. Prefer checks + thin adapters over new features.

Related: [`IMAGING_RUNBOOK.md`](./IMAGING_RUNBOOK.md) · [`IMAGING_ADAPTERS.md`](./IMAGING_ADAPTERS.md) · [`IMAGING_TELEMETRY.md`](./IMAGING_TELEMETRY.md) · [`IMAGING_GOLDEN_TOUR.md`](./IMAGING_GOLDEN_TOUR.md)

Agent: `.cursor/agents/franchir-imaging-stabilize.md`

---

## Phase A (do first)

### 1. SoT sync / pin parity

| Check | Command (tracker root) | Pass |
|-------|------------------------|------|
| `@franchir/imaging` pin | `npm run imaging:check` | Tracker + Q sibling digest match |
| `@franchir/imaging-viewer` pin | `npm run imaging-viewer:check` | Version + assets + `public/` install |
| Golden path CI | `npm run imaging:golden-path -- --ci` | Exit 0 (fixtures + viewer check; skips Q `imaging:check`) |

Rules: edit packages **only** in tracker → bump version/CHANGELOG → `imaging*:sync` → PR tracker first, then Q pin. Never fix-only-in-Q.

### 2. Adapters stay thin

App code may own: auth, listing, signed-URL TTL / soft-refresh, worker rewrite host wiring, telemetry forwarders, export API routes.

App code must **not** fork: dwv engine, OpenJPEG policy, grouping heuristics, viewer chrome logic that belongs in `@franchir/imaging*`.

Pointers: [`IMAGING_ADAPTERS.md`](./IMAGING_ADAPTERS.md).

### 3. Telemetry watch (non-PHI)

After deploy, watch product analytics for spikes (no patient ids / SUIDs / URLs in tickets):

| Signal | Suspect |
|--------|---------|
| `imaging_ready_without_pixels` / `imaging_worker_asset_fail` | Worker rewrite / `public/dwv-workers` |
| `imaging_openjpeg_fallback` | Expected for some DX; confirm OpenJPEG TTFP OK |
| High p95 `imaging_time_to_first_paint` / `imaging_series_open_ms` | Signed URL / decode / pool |
| `imaging_dicom_export` failures | Study ZIP chunked path / Storage stream |

Contract: [`IMAGING_TELEMETRY.md`](./IMAGING_TELEMETRY.md).

### 4. Post-deploy smoke (Tania + Fatima)

Use staging or known anonymized fixtures only. See runbook section **Post-deploy smoke — Tania + Fatima**. Do not paste live SeriesInstanceUIDs or signed URLs.

### 5. Branch hygiene

Delete remote imaging branches whose PRs are **MERGED** (or clearly superseded). Keep active `feat/imaging-p6*` / staging lanes. Prefer `git push origin --delete <branch>` after squash merge confirmation via `gh pr view`.

---

## Deferred (not Phase A)

- Delete clinicien (soft/hard)
- MP4 native in prod
- Async study ZIP job queue
- Dedicated `/host` surface

---

## Two-repo discipline

Cross-app fix = **two PRs** (tracker first). After redeploy: pin check + smoke Tania/Fatima + telemetry glance.
