# Franchir Imaging Viewer — produit

## Statut roadmap

| Phase | Version | Statut | Contenu |
|-------|---------|--------|---------|
| **P0** | 0.1.0 | **done** | Contrat + policy (+ helpers purs layout / pixel-signal / pool-plan) |
| **P1** | 0.2.0 | **done** | Engine dwv portable (`dwv-app`, `stack`, `pool`, `sequential`) + assets SoT (`assets/` + MANIFEST sha256) + sync/check vers `public/` des deux apps |
| **P2** | 0.3.0 | **done** | Shell React `@franchir/imaging-viewer/ui` (toolbar, overlays, info banner, series nav busy) + `DicomJpeg2000FallbackViewer` partagé |
| **P2.1** | 0.4.0 | **landed** | Host React `DicomViewer` + `useDwvViewportResize` + PDF encapsulé DOC (`DicomEncapsulatedPdfViewer` + extract purs) |
| **P2.2a** | 0.5.0 | **landed** | Helpers rewrite Next workers + chemins OpenJPEG (`/worker-rewrite`) — SoT partagé, adapters app minces |
| **P2.2b** | — | apps | Listing / auth signed URL (adapters) — hors package |
| **P3a** | 0.6.0 | **landed** | Observabilité produit non-PHI (`onImagingTelemetry`) — TTFP, fallback OpenJPEG, canvas noir, workers |
| **P3b/c** | — | apps | Upload-time SUID, deep-link séries, runbook ops — hors package |
| **P4** | 0.7.0 | **landed** | Feature flags capabilities (openjpeg / pdf / mp4) + `resolveViewerCapabilities` ; adapters app allégés ; roadmap sync |
| **P4∥** | 0.8.0 | **landed** | Chrome export DICOM (`onDownloadSeries` / `onDownloadStudy`) — ZIP brut via adapters app |
| **P4+** | — | next | Raffinements host (tests e2e, golden tour) ; `/host` seulement si le barrel `/ui` devient trop lourd |

## Promesse

Une seule politique, une seule orchestration dwv, un host React aligné, et un
chrome UX commun pour Marcel (tracker) et le clinicien (questionnaires) : mêmes
messages, mêmes plafonds pool, même gate « pixels réellement décodés », même
fallback OpenJPEG, même viewer PDF DOC.

## Source de vérité

| Couche | Package / chemin | SoT |
|--------|------------------|-----|
| Grouping / dédup séries | `@franchir/imaging` | tracker |
| Contrat + policy + extract PDF + engine dwv + assets codec | `@franchir/imaging-viewer` | tracker |
| Host React + chrome + PDF DOC + fallback OpenJPEG | `@franchir/imaging-viewer/ui` | tracker |
| Auth, URLs signées, listing documents | apps | thin adapters |
| Rewrite paths workers + OpenJPEG (purs) | `@franchir/imaging-viewer/worker-rewrite` | tracker |
| Télémétrie produit (formes + emit) | `@franchir/imaging-viewer` `telemetry.ts` + prop `onImagingTelemetry` | tracker |
| Capabilities / feature flags | `@franchir/imaging-viewer` `ViewerCapabilities` + `resolveViewerCapabilities` | tracker |
| Forward analytics (gtag / plausible) | adapters app | apps |
| Workers / OpenJPEG servis | `public/dwv-workers`, `public/openjpeg` | **installés depuis** `packages/imaging-viewer/assets` |

## Discipline sync

1. Éditer uniquement `franchir-patient-tracker/packages/imaging-viewer`
   (code **et** binaires sous `assets/`).
2. Bump `version` + `CHANGELOG.md`.
3. `npm run imaging-viewer:sync` — pin Q + installe les assets dans les deux
   `public/`, régénère `assets/MANIFEST.json`.
4. PR tracker d’abord, puis PR questionnaires avec le pin.
5. CI : `imaging-viewer:check` (package + checksums public) + `test:imaging-viewer`.

Ne pas modifier la copie pinée côté questionnaires sauf hotfix d’urgence
(puis re-sync depuis SoT).

## Assets codec (P1)

SoT binaire : `packages/imaging-viewer/assets/{dwv-workers,openjpeg}`.

- `MANIFEST.json` : sha256 par fichier.
- Sync copie vers `public/` tracker **et** questionnaires.
- Check échoue si `public/` d’une app diverge du package.
- Chemins rewrite Next : SoT `src/worker-rewrite.ts` ; apps branchent
  `proxy.ts` / `next.config` dessus (P2.2a).

## Feature flags (P4)

| Flag | Default package | Où brancher |
|------|-----------------|-------------|
| `jpeg2000OpenJpegFallback` | `true` | Host `DicomViewer` coupe `onJpeg2000Unsupported` si `false` |
| `encapsulatedPdf` | `true` | Listing app : cartes DOC → viewer PDF (adapter) |
| `mp4Native` | `false` | Marcel : `NEXT_PUBLIC_ENABLE_MP4_VIEWER` via `getAppViewerCapabilities()` |
| `pixelSignalGate` | `true` | Engine / policy (canvas noir) |
| `stackMode` / `sequentialMode` | `true` | Documentaires ; plafonds pool inchangés |

```ts
import { resolveViewerCapabilities } from '@franchir/imaging-viewer'

const caps = resolveViewerCapabilities({ mp4Native: true })
// → DicomViewer capabilities={caps} ou routing listing
```

## Comment changer la visionneuse

| Besoin | Où éditer |
|--------|-----------|
| Messages, plafonds pool, détection JPEG 2000 / orientation | `packages/imaging-viewer/src/policy.ts` |
| Feature flags capabilities | `contract.ts` `ViewerCapabilities` + `resolveViewerCapabilities` |
| Gate pixels / layout retries | `pixel-signal.ts`, `layout.ts`, `pool-plan.ts` |
| Création App dwv, stack, pool, nav séquentielle | `@franchir/imaging-viewer/engine` |
| Host React dwv, toolbar, overlays, PDF DOC, fallback OpenJPEG | `@franchir/imaging-viewer/ui` |
| Extract PDF encapsulé (purs) | `src/encapsulated-pdf.ts` (barrel `.`) |
| Rewrite workers / préfixes publics OpenJPEG | `src/worker-rewrite.ts` puis adapters `proxy.ts` |
| Workers / OpenJPEG (binaires) | `packages/imaging-viewer/assets/` puis sync |
| URLs signées, auth, routing, listing | apps (adapters `dicom-viewer.tsx`, documents) |
| Branch analytics Imaging | apps (`report-imaging-telemetry` + `onImagingTelemetry`) |
| Grouping séries | `@franchir/imaging` |

Puis : bump → `imaging-viewer:sync` → PR tracker → PR Q.

## Observabilité (P3a)

Événements client-safe (pas de PHI, pas d’URL) :

| Event | Signification |
|-------|----------------|
| `time_to_first_paint` | Première frame prête (dwv ou OpenJPEG) |
| `series_open_ms` | Durée jusqu’à ready/error pour une ouverture |
| `openjpeg_fallback` | dwv J2K non supporté → repli OpenJPEG |
| `ready_without_pixels` | Géométrie OK, buffer pixels vide (canvas noir évité) |
| `worker_asset_fail` | Échec ressemblant à un worker codec introuvable |

Ops : `docs/ops/IMAGING_TELEMETRY.md`.

## Différé / lanes parallèles

- Listing documents / auth signed URL encore côté apps (P2.2b).
- Tests e2e host / golden Fatima-Tania encore côté apps.
- **`/host` subpath** — différé : `DicomViewer` compose déjà le chrome `/ui` ;
  un export séparé ne réduit pas le graphe host. Réévaluer si des imports
  chrome-only tirent dwv malgré le tree-shake.
- **Export / ZIP DICOM download** — lane sibling (hors package / hors P4
  capabilities) ; ne pas mélanger les PRs.

## Évolution Marcel

Éditer UI + engine + policy ici, sync vers Q, n’ajuster le host app que pour
l’auth / URLs. Divergence de message, plafond pool, chrome, ou binaire codec =
bug produit.

Agent Cursor : `.cursor/agents/franchir-imaging.md`.
