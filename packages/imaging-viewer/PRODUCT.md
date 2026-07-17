# Franchir Imaging Viewer — produit (P0)

## Promesse

Une seule politique viewer pour Marcel (tracker) et le clinicien (questionnaires) :
mêmes messages, mêmes plafonds pool, même gate « pixels réellement décodés »,
même détection JPEG 2000 / orientation — sans forks silencieux.

## Source de vérité

| Couche | Package | SoT |
|--------|---------|-----|
| Grouping / dédup séries | `@franchir/imaging` | tracker |
| Contrat + policy + helpers purs viewer | `@franchir/imaging-viewer` | tracker |
| Shell React + dwv App | apps (`components/.../dicom-viewer*`) | parité manuelle → **P1 extract** |
| Workers codec / OpenJPEG | `public/dwv-workers`, assets openjpeg | **même set dans les deux apps** (pas encore packagé) |

## Discipline sync

1. Éditer uniquement `franchir-patient-tracker/packages/imaging-viewer`.
2. Bump `version` + `CHANGELOG.md`.
3. `npm run imaging-viewer:sync` (cible sibling `Franchir_Questionnaires_Patients`).
4. PR tracker d’abord, puis PR questionnaires avec le pin.
5. `imaging-viewer:check` + tests package en CI.

Ne pas modifier la copie pinée côté questionnaires sauf hotfix d’urgence
(puis re-sync depuis SoT).

## Assets codec (hors package)

Les workers dwv (`jpeg2000`, `jpegls`, …) et le repli OpenJPEG restent dans
chaque app (`public/dwv-workers`, middleware rewrite `/_next/.../assets/workers`).
**P0** : garder les fichiers alignés manuellement ; noter tout changement de
binaire dans les deux PRs. Checksum / packaging → backlog P1.

## Roadmap P1

- Extraire le shell React `DicomViewer` + modules dwv (`*-app`, `*-stack`,
  `*-pool`, `*-sequential`) dans ce package (ou `@franchir/imaging-viewer-react`).
- Packaging / checksum des workers + OpenJPEG.
- Un seul chemin d’import produit ; supprimer les shims de re-export locaux.

## Évolution Marcel

Éditer la policy et le contrat ici, sync vers Q, puis n’ajuster le shell React
tracker que pour l’orchestration Next/dwv. Toute divergence de message ou de
plafond pool = bug produit, pas une « variante clinicien ».
