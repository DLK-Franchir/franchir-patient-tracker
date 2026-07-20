# Imaging adapters (P2.2b / P3b / P4) — tracker Marcel

App-local wiring around `@franchir/imaging-viewer` (package SoT). Do not put auth / listing / signed-URL TTL in the package.

## Paths

| Concern | Module |
|---------|--------|
| Listing + batch signed URLs | `lib/documents/list-patient-documents.ts` (TTL `SIGNED_URL_TTL_SECONDS` = 1800) |
| Soft-refresh before open | `lib/documents/signed-url-freshness.ts` + `components/patient/documents-section.tsx` |
| Pont Q imaging (no Range enrich by default) | `lib/integrations/fetch-questionnaire-imaging.ts` (`enrichMetadata=0`) |
| Series / DOC PDF grouping | `@franchir/imaging` via `groupDicomFilesByMetadata` |
| PDF encapsulé UI | adapter → `@franchir/imaging-viewer/ui` (`dicom-encapsulated-pdf-viewer.tsx`) |
| Upload-time SUID persist (P3b) | `lib/documents/prepare-dicom-for-upload.ts` → finalize → `patient_documents.series_instance_uid` |
| Legacy backfill (P3b) | `POST /api/internal/imaging/backfill-dicom-metadata` + `scripts/backfill-dicom-metadata.mjs` |
| Workers rewrite | `proxy.ts` (lane A — not this doc) |
| Product telemetry (P3a) | `onImagingTelemetry` → `lib/imaging/report-imaging-telemetry.ts` — see `IMAGING_TELEMETRY.md` |
| DICOM export ZIP (P0/P1/P5/P7) | `GET …/export-plan` + sync `…/export.zip?part=N` **ou** async `POST …/export-async` + `…/build` + signed TTL ; UI `downloadStudyDicomExport` |
| Capabilities / feature flags (P4/P7) | `lib/imaging/viewer-capabilities.ts` → `getAppViewerCapabilities()` (`mp4Native` from `isMp4ViewerEnabled`) |

## MP4 / m4v native viewer — prod ops flip

Code prêt sur Marcel **et** clinicien (HTML5 `<video>`, H.264/AAC). Le package
garde `mp4Native: false` par défaut ; l’activation prod est **explicite** (pas
d’auto-enable en Production, pour ne pas surprendre les navigateurs sans codec).

| Environnement | Comportement |
|---------------|--------------|
| `development` / Vercel **Preview** | Actif automatiquement |
| Vercel **Production** | Off tant que le flag n’est pas posé |

**Variables acceptées** (truthy : `true` / `1` / `yes`) :

| Variable | Rôle |
|----------|------|
| `NEXT_PUBLIC_ENABLE_MP4_VIEWER` | Canonique |
| `NEXT_PUBLIC_MP4_VIEWER` | Alias (ex. `1`) |

**Vercel — poser sur Production des deux apps**, puis redeploy :

| Projet Vercel | Domaine |
|---------------|---------|
| `franchir-patient-tracker` | https://patients.franchir.eu |
| `franchir-questionnaires-patients` | https://questionnaire.franchir.eu |

```bash
# Exemple CLI (Production) — même valeur sur les deux projets
vercel env add NEXT_PUBLIC_ENABLE_MP4_VIEWER production
# valeur : true
# puis redeploy Production des deux apps
```

Smoke post-flip (sans PHI) : upload / ouvrir un `.mp4` et un `.m4v` sur Marcel
et sur la fiche clinicien — badge MP4 + lecteur `data-testid="native-mp4-viewer"`.

**P5/P7 study ZIP** — sous plafond sync (400 fichiers) → un ZIP ; Fatima →
`recommendAsync` + job Storage (`exports/{patientId}/{jobId}/`, parties ≤80
fichiers / ~90 Mo) puis signed download TTL. Fallback sync chunked si async
indisponible. Delete clinicien = différé (SoT Marcel only).

## Rules

1. **Fast-open** — open with in-memory URLs when listing age &lt; ~25 min. No re-fetch / enrich on every click.
2. **Soft-refresh** — if listing is stale, remint signed URLs then open (manual « Actualiser les liens » also available).
3. **SoT meta** — `patient_documents` SeriesInstanceUID drives grouping; Q forward is secondary / deduped.
4. **DOC PDF** — `dicom-pdf-series` cards route to encapsulated PDF viewer, not dwv image stack.
5. **Upload-time SoT (P3b)** — new DICOM uploads always extract header meta client-side, rename with `SUID.*` when needed, and persist `series_instance_uid` / SOP / instance on finalize. Do **not** rely on list-time `enrichMetadata=1`.

Ops triage / deep-link / golden-path: [`IMAGING_RUNBOOK.md`](./IMAGING_RUNBOOK.md).  
Phase A stabilize: [`IMAGING_STABILIZE.md`](./IMAGING_STABILIZE.md).
## Legacy backfill (P3b)

Rows uploaded before upload-time persist may have `series_instance_uid IS NULL`.

**Preferred (service-token, non-destructive)** — fill missing columns only:

```bash
curl -sS -X POST "$TRACKER_URL/api/internal/imaging/backfill-dicom-metadata" \
  -H "Authorization: Bearer $TRACKER_SYNC_SERVICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"patientId":"<uuid>","dryRun":true}'
# then dryRun:false
```

Response = counters only (`scanned` / `parseOk` / `updated` / …). No file names or UIDs in logs.

**CLI (local, includes optional SOP dedupe)** — `node scripts/backfill-dicom-metadata.mjs <patientId> [--dry-run]` (service-role from `.env.local`). Use for destructive dedupe; prefer dry-run first.

After backfill, Marcel listing groups by SeriesInstanceUID without Range enrich.
