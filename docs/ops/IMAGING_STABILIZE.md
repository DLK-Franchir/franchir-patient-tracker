# Imaging stabilize — suite P0–P8 + hygiene

Post-merge consolidation for Franchir Imaging (tracker SoT ↔ clinicien pin).
No PHI. Prefer checks + thin adapters over new features.

Related: [`IMAGING_RUNBOOK.md`](./IMAGING_RUNBOOK.md) · [`IMAGING_ADAPTERS.md`](./IMAGING_ADAPTERS.md) · [`IMAGING_TELEMETRY.md`](./IMAGING_TELEMETRY.md) · [`IMAGING_GOLDEN_TOUR.md`](./IMAGING_GOLDEN_TOUR.md) · [`../../packages/imaging-viewer/PRODUCT.md`](../../packages/imaging-viewer/PRODUCT.md)

Agent: `.cursor/agents/franchir-imaging-stabilize.md`

---

## Suite complete checklist (P0–P8 → 0.13.0+)

Use this once after the imaging suite lands (or after a large multi-PR imaging merge). Mark when verified.

| # | Item | How | Pass |
|---|------|-----|------|
| 1 | Roadmap PRODUCT closed | `packages/imaging-viewer/PRODUCT.md` — P0–P8 **done**, residuals = ops only, MPR/DICOMDIR/annotations = future | ☐ |
| 2 | Pin `@franchir/imaging` | Tracker: `npm run imaging:check` | ☐ |
| 3 | Pin `@franchir/imaging-viewer` ≥ 0.13.0 | Tracker: `npm run imaging-viewer:check` (Q sibling digest match) | ☐ |
| 4 | Golden path CI | `npm run imaging:golden-path -- --ci` | ☐ |
| 5 | P7 async export live | Staging/prod: Fatima-scale study → `export-async` job + signed TTL (no PHI in tickets) | ☐ |
| 6 | P8 telemetry contract | `GET /api/internal/imaging/telemetry-summary` (Bearer) + glance thresholds in [`IMAGING_TELEMETRY.md`](./IMAGING_TELEMETRY.md) | ☐ |
| 7 | mp4Native parity | Marcel + clinicien: staging/preview/flag only (`NEXT_PUBLIC_ENABLE_MP4_VIEWER`) — prod default still off | ☐ |
| 8 | Post-deploy smoke | Tania + Fatima — runbook section **Post-deploy smoke** (anonymized fixtures only) | ☐ |
| 9 | Branch hygiene | Imaging feature branches whose PRs are **MERGED** deleted remotely | ☐ |
| 10 | Agents current | `.cursor/agents/franchir-imaging*.md` reflect ~0.13.0+ suite complete | ☐ |

**Suite terminée** when rows 1–10 are checked (or explicitly waived with reason in the PR).

Q pointer: `Franchir_Questionnaires_Patients/docs/ops/IMAGING_STABILIZE.md` → this file.

---

## Ongoing hygiene (Phase A — repeat after imaging deploys)

### 1. SoT sync / pin parity

| Check | Command (tracker root) | Pass |
|-------|------------------------|------|
| `@franchir/imaging` pin | `npm run imaging:check` | Tracker + Q sibling digest match |
| `@franchir/imaging-viewer` pin | `npm run imaging-viewer:check` | Version + assets + `public/` install |
| Golden path CI | `npm run imaging:golden-path -- --ci` | Exit 0 (fixtures + viewer check; skips Q `imaging:check`) |

Rules: edit packages **only** in tracker → bump version/CHANGELOG → `imaging*:sync` → PR tracker first, then Q pin. Never fix-only-in-Q.

### 2. Adapters stay thin

App code may own: auth, listing, signed-URL TTL / soft-refresh, worker rewrite host wiring, telemetry forwarders, export API routes (sync + async).

App code must **not** fork: dwv engine, OpenJPEG policy, grouping heuristics, viewer chrome logic that belongs in `@franchir/imaging*`.

Pointers: [`IMAGING_ADAPTERS.md`](./IMAGING_ADAPTERS.md).

### 3. Telemetry watch (non-PHI)

After deploy, watch product analytics for spikes (no patient ids / SUIDs / URLs in tickets).
Numeric thresholds + gtag/Plausible how-to: [`IMAGING_TELEMETRY.md`](./IMAGING_TELEMETRY.md) (P8).

| Signal | Threshold (≈1 h) | Suspect |
|--------|------------------|---------|
| `imaging_ready_without_pixels` | ≥ 5 | Worker rewrite / blank-canvas gate |
| `imaging_worker_asset_fail` | ≥ 3 | `public/dwv-workers` / `/_next` rewrite |
| `imaging_openjpeg_fallback` | (watch TTFP) | Expected for some DX |
| p95 `imaging_time_to_first_paint` / `series_open_ms` | ≥ 15s / 30s | Signed URL / decode / pool |
| `imaging_dicom_export` error rate | ≥ 20% | Chunked ZIP / async Storage |

Contract smoke (Bearer sync/return):
`GET /api/internal/imaging/telemetry-summary`.

### 4. Post-deploy smoke (Tania + Fatima)

Use staging or known anonymized fixtures only. See runbook section **Post-deploy smoke — Tania + Fatima**. Do not paste live SeriesInstanceUIDs or signed URLs.

### 5. Branch hygiene

Delete remote imaging branches whose PRs are **MERGED** (or clearly superseded). Prefer `git push origin --delete <branch>` after squash merge confirmation via `gh pr view`.

---

## Residuals (ops — not open suite phases)

- Delete clinicien (soft/hard) — SoT Marcel only today
- MP4 native **prod** default (`mp4Native` stays false)
- Async ZIP Storage cleanup / cron (optional post-0.13.0 ops patch)
- Dedicated `/host` surface
- Broader e2e host / golden tour polish

## Hors suite (future)

- MPR
- DICOMDIR / CD companions
- Annotations / persistent measurements

---

## Two-repo discipline

Cross-app fix = **two PRs** (tracker first). After redeploy: pin check + smoke Tania/Fatima + telemetry glance.
