# `@franchir/imaging-viewer`

Couche produit partagée de la visionneuse DICOM Franchir : **contrat**,
**politique codec/UX**, et **helpers purs** (pool, layout, signal pixel).

| Repo | Rôle | Chemin |
|------|------|--------|
| `franchir-patient-tracker` | **Source de vérité** — éditer ici | `packages/imaging-viewer` |
| `Franchir_Questionnaires_Patients` | Copie pinée (Vercel isolé) | `packages/imaging-viewer` |

Voir aussi [`PRODUCT.md`](./PRODUCT.md) (promesse produit + roadmap P1).

## Discipline

1. Modifier uniquement dans le **tracker**.
2. Bump semver + note dans `CHANGELOG.md`.
3. `npm run imaging-viewer:sync` → copie vers questionnaires.
4. CI : `npm run imaging-viewer:check` (fail si drift) + `npm run test:imaging-viewer`.

## Scope P0 (ce package)

- Types contrat : `ImagingSeries`, `ImagingViewerItem`, `ViewerCapabilities`, …
- Constantes / messages / formatters (orientation, JPEG 2000, load errors)
- `pool-plan`, layout helpers (sans React / sans import `dwv`)
- `hasPixelSignal` (gate canvas noir vs pixels décodés)

## Hors scope (P1)

- Shell React `DicomViewer` + orchestration dwv
- Binaires OpenJPEG / workers `public/dwv-workers` (les deux apps doivent
  shipper les mêmes assets — checksum documenté dans PRODUCT.md)

Companion grouping : `@franchir/imaging`.
