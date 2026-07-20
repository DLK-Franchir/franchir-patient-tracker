# Imaging adapters (P2.2b) — tracker Marcel

App-local wiring around `@franchir/imaging-viewer` (package SoT). Do not put auth / listing / signed-URL TTL in the package.

## Paths

| Concern | Module |
|---------|--------|
| Listing + batch signed URLs | `lib/documents/list-patient-documents.ts` (TTL `SIGNED_URL_TTL_SECONDS` = 1800) |
| Soft-refresh before open | `lib/documents/signed-url-freshness.ts` + `components/patient/documents-section.tsx` |
| Pont Q imaging (no Range enrich by default) | `lib/integrations/fetch-questionnaire-imaging.ts` (`enrichMetadata=0`) |
| Series / DOC PDF grouping | `@franchir/imaging` via `groupDicomFilesByMetadata` |
| PDF encapsulé UI | adapter → `@franchir/imaging-viewer/ui` (`dicom-encapsulated-pdf-viewer.tsx`) |
| Workers rewrite | `proxy.ts` (lane A — not this doc) |

## Rules

1. **Fast-open** — open with in-memory URLs when listing age &lt; ~25 min. No re-fetch / enrich on every click.
2. **Soft-refresh** — if listing is stale, remint signed URLs then open (manual « Actualiser les liens » also available).
3. **SoT meta** — `patient_documents` SeriesInstanceUID drives grouping; Q forward is secondary / deduped.
4. **DOC PDF** — `dicom-pdf-series` cards route to encapsulated PDF viewer, not dwv image stack.

Ops triage / deep-link / golden-path: [`IMAGING_RUNBOOK.md`](./IMAGING_RUNBOOK.md).
