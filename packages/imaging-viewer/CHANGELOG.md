# Changelog — `@franchir/imaging-viewer`

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
