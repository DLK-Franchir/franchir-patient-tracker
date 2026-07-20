# `@franchir/imaging-viewer`

Couche produit partagée de la visionneuse DICOM Franchir : **contrat**,
**politique codec/UX**, **orchestration dwv** (stack / pool / sequential), et
**assets codec** (workers + OpenJPEG).

| Repo | Rôle | Chemin |
|------|------|--------|
| `franchir-patient-tracker` | **Source de vérité** — éditer ici | `packages/imaging-viewer` |
| `Franchir_Questionnaires_Patients` | Copie pinée (Vercel isolé) | `packages/imaging-viewer` |

Voir aussi [`PRODUCT.md`](./PRODUCT.md).

## Discipline

1. Modifier uniquement dans le **tracker** (src **et** `assets/`).
2. Bump semver + note dans `CHANGELOG.md`.
3. `npm run imaging-viewer:sync` → pin Q + install `public/` des deux apps.
4. CI : `npm run imaging-viewer:check` + `npm run test:imaging-viewer`.

## Scope P1 (ce package)

- Types contrat + policy (P0)
- Engine dwv : `dwv-app`, `stack`, `pool`, `sequential`
- Assets : `assets/dwv-workers/*`, `assets/openjpeg/openjpegjs.js` + MANIFEST

## Hors scope (P2)

- Shell React unifié `<DicomViewer>` (chrome toolbar/overlays)
- Viewer fallback OpenJPEG React (helpers decode restent app-local pour l’instant)

Peer deps : `react`, `react-dom`, `dwv` (^0.36).

Companion grouping : `@franchir/imaging`.
