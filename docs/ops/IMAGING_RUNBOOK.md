# Imaging ops runbook — tracker Marcel

Durable triage for Franchir Imaging (DICOM viewer) across **patients.franchir.eu** (Marcel) and **questionnaire.franchir.eu** (clinicien). No PHI in tickets or logs.

Related:

- Adapters (signed URLs / fast-open): [`IMAGING_ADAPTERS.md`](./IMAGING_ADAPTERS.md)
- Golden tour (fixtures): [`IMAGING_GOLDEN_TOUR.md`](./IMAGING_GOLDEN_TOUR.md)
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

## Golden-path

```bash
# Tracker SoT (`imaging:golden-path` is an alias of `imaging:golden-tour`)
npm run imaging:golden-path           # local (may run imaging:check if Q sibling present)
npm run imaging:golden-path -- --ci   # CI-safe: focused fixtures + imaging-viewer:check
npm run imaging:golden-path -- --full # full package suites
```

Script: [`scripts/imaging-golden-tour.mjs`](../../scripts/imaging-golden-tour.mjs). Details: [`IMAGING_GOLDEN_TOUR.md`](./IMAGING_GOLDEN_TOUR.md).

CI: optional job `imaging-golden-path` in `.github/workflows/ci.yml` (`continue-on-error: false` but isolated job so quality stays green if you temporarily disable it). Prefer `--ci` only — no Q checkout required.

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

After redeploy: hard-refresh viewer, spot-check workers 200 + one J2K series on staging if available.

---

## Agent pointers

- Imaging product: `.cursor/agents/franchir-imaging.md`
- Preload / render runtime: `.cursor/agents/dicom-viewer-debugger.md`
