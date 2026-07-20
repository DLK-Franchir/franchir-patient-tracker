# `@franchir/imaging-viewer`

Couche produit partagée de la visionneuse DICOM Franchir : **contrat**,
**politique codec/UX**, **orchestration dwv**, **shell React**, et
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

## Exports

| Subpath | Contenu | SSR-safe |
|---------|---------|----------|
| `@franchir/imaging-viewer` | Contrat + policy + helpers purs | oui |
| `@franchir/imaging-viewer/engine` | Hooks / App dwv | client (peer dwv) |
| `@franchir/imaging-viewer/ui` | Chrome React + fallback OpenJPEG | **client only** |

## Hors scope (P2.1)

- Host dwv unique `<DicomViewer>` (lifecycle stack/pool encore dans les apps)
- PDF encapsulé DOC

Peer deps : `react`, `react-dom`, `dwv` (^0.36), `lucide-react` (UI).

Companion grouping : `@franchir/imaging`.
