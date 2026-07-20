# Franchir Imaging Viewer — produit

## Statut roadmap

| Phase | Version | Statut | Contenu |
|-------|---------|--------|---------|
| **P0** | 0.1.0 | **done** | Contrat + policy (+ helpers purs layout / pixel-signal / pool-plan) |
| **P1** | 0.2.0 | **done** | Engine dwv portable (`dwv-app`, `stack`, `pool`, `sequential`) + assets SoT (`assets/` + MANIFEST sha256) + sync/check vers `public/` des deux apps |
| **P2** | 0.3.0 | **done** | Shell React `@franchir/imaging-viewer/ui` (toolbar, overlays, info banner, series nav busy) + `DicomJpeg2000FallbackViewer` partagé |
| **P2.1** | 0.4.0 | **landed** | Host React `DicomViewer` + `useDwvViewportResize` + PDF encapsulé DOC (`DicomEncapsulatedPdfViewer` + extract purs) |
| **P2.2 / P3** | — | next | Rewrite workers Next app-local ; raffinements host (tests e2e, surface dwv encore plus découplée) ; éventuel subpath `/host` si besoin |

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
| Auth, URLs signées, listing documents, rewrite workers | apps | thin adapters |
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
- Rewrite Next `/_next/.../assets/workers` → `/dwv-workers` reste **app-local**
  (`proxy.ts` / middleware) — hors package (P2.2).

## Comment changer la visionneuse

| Besoin | Où éditer |
|--------|-----------|
| Messages, plafonds pool, détection JPEG 2000 / orientation | `packages/imaging-viewer/src/policy.ts` |
| Gate pixels / layout retries | `pixel-signal.ts`, `layout.ts`, `pool-plan.ts` |
| Création App dwv, stack, pool, nav séquentielle | `@franchir/imaging-viewer/engine` |
| Host React dwv, toolbar, overlays, PDF DOC, fallback OpenJPEG | `@franchir/imaging-viewer/ui` |
| Extract PDF encapsulé (purs) | `src/encapsulated-pdf.ts` (barrel `.`) |
| Workers / OpenJPEG (binaires) | `packages/imaging-viewer/assets/` puis sync |
| URLs signées, auth, routing, listing | apps (adapters `dicom-viewer.tsx`, documents) |
| Grouping séries | `@franchir/imaging` |

Puis : bump → `imaging-viewer:sync` → PR tracker → PR Q.

## Différé (P2.2 / P3)

- Rewrite middleware workers Next (`proxy.ts`) — intrinsèquement app-local.
- Tests e2e host / golden Fatima-Tania encore côté apps.
- Éventuelle séparation subpath `/host` si le barrel `/ui` devient trop lourd
  pour certains imports chrome-only.

## Évolution Marcel

Éditer UI + engine + policy ici, sync vers Q, n’ajuster le host app que pour
l’auth / URLs. Divergence de message, plafond pool, chrome, ou binaire codec =
bug produit.

Agent Cursor : `.cursor/agents/franchir-imaging.md`.
