# Franchir Imaging Viewer — produit

## Statut roadmap

| Phase | Version | Statut | Contenu |
|-------|---------|--------|---------|
| **P0** | 0.1.0 | **done** | Contrat + policy (+ helpers purs layout / pixel-signal / pool-plan) |
| **P1** | 0.2.0 | **landed** | Engine dwv portable (`dwv-app`, `stack`, `pool`, `sequential`) + assets SoT (`assets/` + MANIFEST sha256) + sync/check vers `public/` des deux apps |
| **P1.1** | — | next si besoin | Affiner adapters / edge cases engine ; pas de shell React |
| **P2** | — | planned | Shell React unifié `<DicomViewer>` (+ fallback OpenJPEG UI partagé) |

Chrome React (toolbar, overlays, lucide/Icon, flags mp4) reste **app-local** —
adapters minces re-exportent le package. Ne pas réintroduire de logique engine
dans les apps.

## Promesse

Une seule politique **et** une seule orchestration dwv pour Marcel (tracker)
et le clinicien (questionnaires) : mêmes messages, mêmes plafonds pool, même
gate « pixels réellement décodés », même stack→sequential, mêmes workers /
OpenJPEG — sans forks silencieux.

## Source de vérité

| Couche | Package / chemin | SoT |
|--------|------------------|-----|
| Grouping / dédup séries | `@franchir/imaging` | tracker |
| Contrat + policy + **engine dwv** (app/stack/pool/sequential) + assets codec | `@franchir/imaging-viewer` | tracker |
| Chrome React (toolbar, overlays, lucide/Icon, feature flags mp4) | apps | parité manuelle → **P2 shell unifié** |
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
  (`proxy.ts` / middleware) — hors package.

## Comment changer la visionneuse

| Besoin | Où éditer |
|--------|-----------|
| Messages, plafonds pool, détection JPEG 2000 / orientation | `packages/imaging-viewer/src/policy.ts` |
| Gate pixels / layout retries | `pixel-signal.ts`, `layout.ts`, `pool-plan.ts` |
| Création App dwv, stack, pool, nav séquentielle | `@franchir/imaging-viewer/engine` (`dwv-app`, `stack`, `pool`, `sequential`) — pas le barrel `.` |
| Workers / OpenJPEG (binaires) | `packages/imaging-viewer/assets/` puis sync |
| Toolbar, overlays, URLs signées, auth, routing | apps (`components/.../dicom-viewer.tsx`, documents) |
| Grouping séries | `@franchir/imaging` |

Puis : bump → `imaging-viewer:sync` → PR tracker → PR Q.

## Différé (P1.1 / P2)

**P1.1 (optionnel)** — restes engine non urgents (hooks encore dépendants de
`dwv` peer + React dans le package ; OK pour P1). Pas d’extract React shell.

**P2**

- Extraire un seul `<DicomViewer>` React partagé (chrome UI) — aujourd’hui
  tracker et Q divergent (lucide vs Icon, toolbar split).
- Déplacer le shell OpenJPEG fallback React (helpers decode déjà alignés).
- Optionnel : sous-path export `@franchir/imaging-viewer/react`.

## Évolution Marcel

Éditer engine + policy ici, sync vers Q, n’ajuster le chrome app que pour
l’UI Next. Divergence de message, plafond pool, ou binaire codec = bug produit.

Agent Cursor : `.cursor/agents/franchir-imaging.md`.
