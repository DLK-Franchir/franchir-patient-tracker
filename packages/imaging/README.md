# `@franchir/imaging`

Primitives partagées pour l’imagerie DICOM (regroupement en séries, dédup
tracker ↔ questionnaires, heuristique PDF encapsulé listing).

| Repo | Rôle | Chemin |
|------|------|--------|
| `franchir-patient-tracker` | **Source de vérité** — éditer ici | `packages/imaging` |
| `Franchir_Questionnaires_Patients` | Copie pinée (Vercel isolé) | `packages/imaging` |

## Discipline

1. Modifier uniquement dans le **tracker**.
2. Bump semver + note dans `CHANGELOG.md`.
3. `npm run imaging:sync` → copie vers questionnaires.
4. CI : `npm run imaging:check` (fail si drift).

## Scope P0 (ce package)

- `groupDicomFilesByMetadata` / `groupDicomFilesIntoSeries`
- `dicom-series-uid-name`, bande PDF encapsulé listing
- `filterQuestionnaireImagingAgainstTracker`

Companion viewer : `@franchir/imaging-viewer` (contrat + policy). Hors scope
ici : shell React `DicomViewer` / workers dwv (roadmap P1 dans ce sibling).
