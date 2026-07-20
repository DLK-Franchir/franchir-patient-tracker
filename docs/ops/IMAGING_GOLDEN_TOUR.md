# Imaging golden tour (P2.2c)

Durable, **non-PHI** checklist for Franchir Imaging product health.
SoT scripts live in this tracker repo; questionnaires may keep a pointer only.

## Quick start

```bash
# From franchir-patient-tracker
npm run imaging:golden-tour

# CI / no questionnaires sibling
npm run imaging:golden-tour -- --ci

# Full package suites + checks
npm run imaging:golden-tour -- --full

# MANIFEST / pin checks only
npm run imaging:golden-tour -- --checks-only
```

Script: [`scripts/imaging-golden-tour.mjs`](../../scripts/imaging-golden-tour.mjs)

**Never** use live patient studies, OneDrive dumps, or prod signed URLs as golden fixtures.

---

## Automatable checklist → fixtures

| # | Item | Automated coverage | Notes |
|---|------|--------------------|-------|
| 1 | Grouping Tania (~11) / Fatima (~42 SUID) | `packages/imaging/src/tania-series-metadata.test.ts`, `packages/imaging/src/dicom-series-group.fatima.test.ts`, `packages/imaging-viewer/src/golden-parity.test.ts` | Synthetic series/SUID fixtures. Literal product counts (~11 / ~42) remain **manual / e2e** (see PRODUCT.md). |
| 2 | OpenJPEG path for JPEG2000 | `packages/imaging-viewer/src/policy.test.ts` (`isUnsupportedJpeg2000Error`), `exports-contract.test.ts`, assets `packages/imaging-viewer/assets/openjpeg/` | Policy + export contract + MANIFEST. Full WASM pixel decode = host/manual. |
| 3 | DOC PDF band | `@franchir/imaging` band heuristic in Fatima grouping tests; `packages/imaging-viewer/src/encapsulated-pdf.test.ts` | Listing band vs extract are separate — both run in the tour. |
| 4 | Localizer multi-plane message | `policy.test.ts` + `golden-parity.test.ts` → `SEQUENTIAL_LOCALIZER_ORIENTATION_MSG` | Message policy only (no PHI). |
| 5 | Worker asset MANIFEST integrity | `npm run imaging-viewer:check` → `packages/imaging-viewer/assets/MANIFEST.json` vs on-disk + `public/` | Also validates Q pin when sibling present. |
| 6 | Package pins | `imaging-viewer:check` always; `imaging:check` when `../Franchir_Questionnaires_Patients` exists | `--ci` skips `imaging:check` (no Q checkout). Use `--require-sibling` locally when both roots are expected. |

Related package docs:

- [`packages/imaging-viewer/PRODUCT.md`](../../packages/imaging-viewer/PRODUCT.md)
- [`packages/imaging-viewer/assets/README.md`](../../packages/imaging-viewer/assets/README.md)

---

## Manual side-by-side (clinicien vs Marcel)

Use **synthetic** or **anonymized staging** studies only. Do not paste patient names, IDs, or URLs into tickets/logs.

| Step | Clinicien (questionnaires) | Marcel (tracker) | Pass criteria |
|------|----------------------------|------------------|---------------|
| A | Open imaging for a known staging study with multi-series MRI | Same study type on tracker patient dossier | Series list count and labels match within product grouping rules |
| B | Select a JPEG2000 series (if available on staging) | Same | Either native decode or OpenJPEG fallback UI; no blank infinite spinner |
| C | Open encapsulated PDF / DOC series if present | Same | PDF band / DOC viewer opens (not treated as pixel stack) |
| D | Select a localizer / multi-plane series | Same | Same orientation fallback message (localizer policy) |
| E | Hard-refresh; confirm workers load | Same | No 404 on `/dwv-workers/*` or `/openjpeg/*` |

If parity fails, check pin first:

```bash
npm run imaging-viewer:check
npm run imaging:check   # needs Q sibling
```

---

## CI (optional)

Existing CI already runs `test:imaging-viewer` and `imaging-viewer:check`.
Optionally add a single step:

```bash
npm run imaging:golden-tour -- --ci
```

`--ci` covers focused fixture tests + `imaging-viewer:check` and skips `imaging:check` (no questionnaires checkout).

---

## Observability / ops

- Exit code `0` + JSON summary on stdout (`ok`, `checklist`, `imagingCheck`).
- Failures print `imaging-golden-tour FAIL: …` and non-zero exit.
- Prefer this tour after imaging package edits and after `imaging*:sync`.
- PHI / secrets: never log series instance UIDs from prod, signed URLs, or patient identifiers.
