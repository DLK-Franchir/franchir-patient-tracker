# Changelog — `@franchir/imaging-viewer`

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
