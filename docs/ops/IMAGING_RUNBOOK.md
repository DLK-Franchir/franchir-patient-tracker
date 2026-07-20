# Imaging ops runbook — tracker Marcel

Durable triage for Franchir Imaging (DICOM viewer) across **patients.franchir.eu** (Marcel) and **questionnaire.franchir.eu** (clinicien). No PHI in tickets or logs.

Related:

- Adapters (signed URLs / fast-open): [`IMAGING_ADAPTERS.md`](./IMAGING_ADAPTERS.md)
- Golden tour (fixtures): [`IMAGING_GOLDEN_TOUR.md`](./IMAGING_GOLDEN_TOUR.md)
- Stabilize Phase A: [`IMAGING_STABILIZE.md`](./IMAGING_STABILIZE.md)
- Telemetry (non-PHI): [`IMAGING_TELEMETRY.md`](./IMAGING_TELEMETRY.md)
- Package product: [`packages/imaging-viewer/PRODUCT.md`](../../packages/imaging-viewer/PRODUCT.md)

---

## Deep-link (P3c)

Open a series from URL without hunting the card list.

| App | Example |
|-----|---------|
| Tracker | `/dashboard/patient/<id>?series=<SeriesInstanceUID\|groupId\|itemId>` |
| Clinicien | `/clinician/<patientId>?tab=imaging&series=<SeriesInstanceUID\|groupId\|itemId>` |

- `series` accepts bare SeriesInstanceUID, `suid:<uid>`, grouping `groupId` (e.g. `series:SE000005`, `patient-im-doc`), or the full viewer item id.
- Clinicien: `series` alone implies the Imagerie tab (`tab=imaging`).
- Matcher: tracker `lib/imaging/resolve-series-deep-link.ts` · Q `src/lib/imaging/resolve-series-deep-link.ts` (parity).

Do **not** paste live SeriesInstanceUIDs from prod into public tickets.

---

## Workers must return 200

dwv 0.36 loads codec workers from paths under `/_next/.../assets/workers/*`. Next `rewrites` in `next.config` do **not** cover `/_next/*`.

| Check | Expected |
|-------|----------|
| Middleware rewrite | `proxy.ts` → `@franchir/imaging-viewer/worker-rewrite` maps worker requests → `/dwv-workers/<file>` |
| Public assets | `public/dwv-workers/*.worker.min.js` installed from package assets |
| Browser Network | `/dwv-workers/*` → **200** (not 404 / HTML login page) |

SoT helpers: `packages/imaging-viewer/src/worker-rewrite.ts`. Thin app adapters: `lib/imaging/dwv-worker-rewrite.ts` (tracker) / Q equivalent.

Quick verify after deploy:

```bash
# From tracker root — pin + public install parity
npm run imaging-viewer:check
```

Hard-refresh the viewer; confirm no 404 on workers.

---

## OpenJPEG / JPEG 2000

Radios DX (JPEG 2000) often fail native dwv decode → **global** OpenJPEG fallback (not per-patient).

| Check | Expected |
|-------|----------|
| Asset | `/openjpeg/openjpegjs.js` (and wasm glue) → **200** |
| Policy | `isUnsupportedJpeg2000Error` → host switches to `DicomJpeg2000FallbackViewer` |
| UX | Visible pixels or explicit fallback UI — never infinite blank “ready” |

Golden fixture coverage: `npm run imaging:golden-path -- --ci` (policy + exports + MANIFEST). Full WASM pixel decode remains host/manual (staging only).

---

## Blank canvas triage

Symptom: viewer shell opens, canvas stays black / empty while UI claims ready.

1. **Workers 404** — fix rewrite / `public/dwv-workers` (above).
2. **Signed URL expired** — soft-refresh listing (TTL ~30 min); see adapters doc. Re-open series after “Actualiser les liens”.
3. **JPEG 2000** — confirm OpenJPEG path; check console for unsupported codec (no PHI).
4. **Pixel gate** — `hasRenderableImage` must require pixel signal, not only Rows/Columns (package policy / pixel-signal).
5. **DOC PDF band** — encapsulated PDF series must use PDF viewer, not dwv stack (`dicom-pdf-series` / `patient-im-doc*`).
6. **Pin drift** — clinicien ≠ Marcel messages/assets → run `imaging-viewer:check` (+ `imaging:check` with Q sibling).

Golden cases (manual / staging, anonymized):

| Case | Focus |
|------|--------|
| Fatima (~42 SUID, DX J2K) | OpenJPEG fallback global |
| Tania (~11 series) | Grouping / nav / loading |

---

## Post-deploy smoke — Tania + Fatima

Run after every imaging deploy (tracker and/or questionnaires). Use **staging** or a known anonymized study set. Never paste patient names, emails, live SeriesInstanceUIDs, or signed URLs into tickets/logs.

### Prep (CI / local, no PHI)

```bash
# Tracker SoT — same command as GitHub job `imaging-golden-path`
npm run imaging:golden-path -- --ci
# alias:
npm run imaging:golden-tour -- --ci

npm run imaging-viewer:check
# with Q sibling present:
npm run imaging:check
```

Expect exit 0. Fixture names **Tania** / **Fatima** are synthetic product labels only.

### Browser smoke (Marcel + clinicien)

Hard-refresh each app. Confirm Network: `/dwv-workers/*` and `/openjpeg/*` → **200**.

| Label | Product focus | Marcel (`patients.franchir.eu`) | Clinicien (`questionnaire.franchir.eu`) | Pass |
|-------|---------------|--------------------------------|------------------------------------------|------|
| **Tania** (~11 series) | Grouping / nav / loading | Patient dossier → Imagerie: series count/labels sensible; open 2–3 series; scroll/arrows OK | Same study type on Imagerie tab | List parity within grouping rules; no infinite spinner |
| **Fatima** (~42 SUID, DX J2K) | OpenJPEG / DOC PDF / blank canvas | Open a JPEG 2000 series → pixels or explicit OpenJPEG UI; DOC/`patient-im-doc*` → PDF band not dwv stack | Same | No black “ready” canvas; workers stay 200 |

Optional deep-link (P3c): open `?series=<groupId>` with a **non-prod** id only (e.g. staging `groupId`). Do not copy prod SUIDs into chat.

### Telemetry glance (non-PHI)

After smoke, glance product analytics for spikes in `imaging_ready_without_pixels`, `imaging_worker_asset_fail`, or high p95 `imaging_series_open_ms`. See [`IMAGING_TELEMETRY.md`](./IMAGING_TELEMETRY.md).

Ticket template (safe):

```text
Deploy: <sha / Vercel deployment id>
Golden-path --ci: pass|fail
Workers/OpenJPEG 200: yes|no
Tania smoke (Marcel / clinicien): pass|fail — note symptom only
Fatima smoke (Marcel / clinicien): pass|fail — note symptom only
Telemetry: quiet|spike:<event name>
```

---

## Golden-path

```bash
# Tracker SoT (`imaging:golden-path` is an alias of `imaging:golden-tour`)
# Note: npm needs `--` before script flags.
npm run imaging:golden-path           # local (may run imaging:check if Q sibling present)
npm run imaging:golden-path -- --ci   # CI-safe: focused fixtures + imaging-viewer:check
npm run imaging:golden-path -- --full # full package suites
npm run imaging:golden-tour -- --ci   # equivalent
```

Script: [`scripts/imaging-golden-tour.mjs`](../../scripts/imaging-golden-tour.mjs). Details: [`IMAGING_GOLDEN_TOUR.md`](./IMAGING_GOLDEN_TOUR.md).

CI: isolated job `imaging-golden-path` in `.github/workflows/ci.yml` runs `npm run imaging:golden-path -- --ci` (no Q checkout). Prefer `--ci` for deploy gates; use sibling `imaging:check` locally when both repos are present.

---

## Async export cleanup (P7)

Jobs Storage sous `exports/{patientId}/{jobId}/` (status.json + parties ZIP)
expirent après **2 h** (`ASYNC_EXPORT_JOB_TTL_MS`). Nettoyage :

| Mécanisme | Détail |
|-----------|--------|
| Cron Vercel | `vercel.json` → `GET /api/internal/imaging/cleanup-async-exports` à `:15` chaque heure (prod only) |
| Opportuniste | GET/build job expiré → **410** + delete best-effort du préfixe |
| Auth | Bearer `CRON_SECRET` (injecté par Vercel Cron) **ou** `TRACKER_SYNC_SERVICE_TOKEN` (ops manuel) |
| Middleware | `/api/internal/imaging` est public-path (auth dans la route) — sinon redirect login |

**Prérequis env Production** : `CRON_SECRET` (géré par Vercel si Cron activé) +
`SUPABASE_SERVICE_ROLE_KEY`. Logs / JSON = compteurs only
(`jobsScanned`, `jobsExpired`, `objectsDeleted`, …) — jamais de patientId /
jobId / paths.

```bash
# Dry-run ops (compteurs)
curl -sS -H "Authorization: Bearer $TRACKER_SYNC_SERVICE_TOKEN" \
  "$TRACKER_URL/api/internal/imaging/cleanup-async-exports?dryRun=1" | jq .

# Apply (même endpoint sans dryRun)
curl -sS -H "Authorization: Bearer $TRACKER_SYNC_SERVICE_TOKEN" \
  "$TRACKER_URL/api/internal/imaging/cleanup-async-exports" | jq .
```

Clinicien (Q) : pas de cron local — les ZIP async vivent dans le bucket tracker.

---

## Sync discipline

| Package | SoT | Sync |
|---------|-----|------|
| `@franchir/imaging` | tracker `packages/imaging` | `npm run imaging:sync` → Q ; CI `imaging:check` |
| `@franchir/imaging-viewer` | tracker `packages/imaging-viewer` | `npm run imaging-viewer:sync` → Q ; CI `imaging-viewer:check` |

Rules:

1. Edit **only** tracker packages (code **and** `assets/` binaries).
2. Bump `version` + `CHANGELOG.md`.
3. Sync → PR **tracker first**, then Q pin PR.
4. Never fix viewer logic only in a Q fork.
5. No PHI / secrets in logs or PR bodies.
6. Cross-app fix = **two PRs**.

After redeploy: hard-refresh viewer, spot-check workers 200 + one J2K series on staging if available. Full smoke: **Post-deploy smoke — Tania + Fatima** above.

---

## Agent pointers

- Imaging product: `.cursor/agents/franchir-imaging.md`
- Stabilize / Phase A: `.cursor/agents/franchir-imaging-stabilize.md` + [`IMAGING_STABILIZE.md`](./IMAGING_STABILIZE.md)
- Preload / render runtime: `.cursor/agents/dicom-viewer-debugger.md`
