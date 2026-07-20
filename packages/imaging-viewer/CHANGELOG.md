# Changelog — `@franchir/imaging-viewer`

## 0.7.0

- P4 : feature flags capabilities documentés —
  `encapsulatedPdf`, `mp4Native` (+ openjpeg / pixel gate déjà présents).
- Helper `resolveViewerCapabilities(overrides?)` pour fusion shallow app/package.
- Prop optionnelle `capabilities` sur `DicomViewer` : si
  `jpeg2000OpenJpegFallback: false`, le callback OpenJPEG n’est pas branché.
- Roadmap PRODUCT : P3 done, P4 landed ; export/ZIP = lane sibling ; `/host`
  différé (pas de gain clair vs barrel `/ui`).

## 0.6.0

- P3a : couche télémétrie produit non-PHI (`telemetry.ts`) — événements
  `time_to_first_paint`, `openjpeg_fallback`, `ready_without_pixels`,
  `series_open_ms`, `worker_asset_fail`.
- Callback optionnel `onImagingTelemetry` sur `DicomViewer` +
  `DicomJpeg2000FallbackViewer` ; émission depuis stack/pool (codec / workers /
  fallback J2K) et host (TTFP / durée d’ouverture).
- Helpers : `emitImagingTelemetry`, `imagingTelemetryToAnalyticsProps`,
  `looksLikeWorkerAssetFailure`, validateurs de forme.
- Apps branchent leur analytics via adapters minces (package sans vendor).

## 0.5.0

- P2.2a : helpers rewrite Next partagés sous
  `@franchir/imaging-viewer/worker-rewrite` (`dwvWorkerRewriteTarget`,
  préfixes publics workers + OpenJPEG, matcher middleware,
  `DWV_NEXT_CONFIG_REWRITES`).
- Apps = thin adapters (`proxy.ts` / `dwv-worker-rewrite.ts`) ; plus de
  duplication de la regex rewrite entre tracker et questionnaires.
- `OPENJPEG_SCRIPT_URL` SoT consommé par le fallback J2K `/ui`.
- Residual P2.2b+ : listing documents / auth signed URL / golden tour — hors
  package.

## 0.4.0

- Extraction P2.1 : host React portable `DicomViewer` sous `/ui` (lifecycle
  stack/pool + chrome + `useDwvViewportResize`).
- Viewer PDF encapsulé DOC partagé : `DicomEncapsulatedPdfViewer` + helpers
  purs `extractEncapsulatedPdf` / `fetchEncapsulatedPdfBlobUrl` /
  `classifyDicomContentFromHeader` (barrel `.`, sans React).
- Apps = adapters minces (dynamic import, auth, URLs signées).
- Residual P2.2 : rewrite workers Next (`proxy.ts`), listing documents /
  grouping wiring, auth boundaries — hors package.

## 0.3.0

- Extraction P2 : shell React partagé sous `@franchir/imaging-viewer/ui`
  (`ViewerInfoBubble`, `DicomSeriesHeader`, `DicomViewerToolbar`, overlays
  loading/error, messages viewport).
- Fallback OpenJPEG unifié `DicomJpeg2000FallbackViewer` + helpers decode
  (`jpeg2000-decode`, `dicom-j2k-extract`, `dicom-windowing`).
- Peer `lucide-react` pour les icônes chrome (référence UX tracker).
- Host dwv (`DicomViewer` lifecycle stack/pool) reste app-local — trop couplé
  au DOM dwv pour un seul composant portable en P2.

## 0.2.0

- Extraction P1 : orchestration dwv partagée (`createDwvApp`, `useDicomStackMode`,
  `useDicomSequentialPool`, `useDicomSequentialNavigation`, helpers render/slice).
- Subpath `@franchir/imaging-viewer/engine` pour le code dwv ; le barrel `.`
  reste sans dwv (évite de tirer dwv.node dans des chemins SSR).
- Packaging codec : `assets/dwv-workers` + `assets/openjpeg` + `MANIFEST.json`
  (sha256) ; `imaging-viewer:sync` installe dans les deux `public/` ;
  `imaging-viewer:check` échoue sur drift binaire.
- Chrome React (`DicomViewer` UI) reste app-local — P2.

## 0.1.0

- Extraction P0 : contrat viewer (`ImagingSeries`, capabilities), politique codec/UX
  (messages orientation, JPEG 2000, erreurs de charge), helpers purs (`pool-plan`,
  layout sans React, `hasPixelSignal`).
- SoT tracker → pin questionnaires via `npm run imaging-viewer:sync`.
