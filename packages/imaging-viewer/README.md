# `@franchir/imaging-viewer`

Couche produit partagée de la visionneuse DICOM Franchir : **contrat**,
**politique codec/UX**, **orchestration dwv**, **host React**, **PDF DOC**,
**shell**, et **assets codec** (workers + OpenJPEG).

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
| `@franchir/imaging-viewer` | Contrat + policy + helpers purs (+ extract PDF + worker-rewrite + telemetry) | oui |
| `@franchir/imaging-viewer/engine` | Hooks / App dwv | client (peer dwv) |
| `@franchir/imaging-viewer/ui` | Host `DicomViewer`, chrome, PDF DOC, fallback OpenJPEG | **client only** |
| `@franchir/imaging-viewer/worker-rewrite` | Chemins publics + rewrite middleware / next.config | oui (Edge-safe) |

## Import paths (apps)

```ts
// Policy / extract PDF (SSR-safe)
import {
  extractEncapsulatedPdf,
  formatDicomLoadError,
  type ImagingTelemetryHandler,
} from '@franchir/imaging-viewer'

// Host: pass onImagingTelemetry from the app analytics adapter (no PHI / no URLs)

// Engine (client modules only)
import { useDicomStackMode } from '@franchir/imaging-viewer/engine'

// Host + chrome + DOC + J2K fallback (client only)
import {
  DicomViewer,
  DicomEncapsulatedPdfViewer,
  DicomJpeg2000FallbackViewer,
  DicomViewerToolbar,
} from '@franchir/imaging-viewer/ui'
```

## Hors scope (P2.2b+)

- Listing documents, auth, signed URL TTL
- Golden tour / smokes e2e host

Peer deps : `react`, `react-dom`, `dwv` (^0.36), `lucide-react` (UI).

Companion grouping : `@franchir/imaging`.
