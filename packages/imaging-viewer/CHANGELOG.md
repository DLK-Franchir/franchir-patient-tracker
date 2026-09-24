# Changelog — `@franchir/imaging-viewer`

## 0.15.3

- **Même barre d’outils** sur le lecteur principal et le repli JPEG 2000
  (Fatima, séries Tania en JPEG 2000) : Fenêtrage, Zoom, Inverser, Miroir,
  Distance, Angle, Cobb, Ciné, Comparer, MPR. Un outil inutilisable reste
  visible et grisé, avec la raison au survol.

## 0.15.2

- **Radios JPEG 2000 (Fatima)** : si Cornerstone ne décode pas l’image, ou si le
  canvas reste un aplat, bascule vers le viewer OpenJPEG (même repli que dwv).
- **MPR** : le message explique les trois vues (de face, de profil, du dessus)
  au lieu d’afficher l’erreur technique du moteur. Le contexte WebGL de la
  coupe est relâché avant d’ouvrir les trois plans.

## 0.15.1

- **U2 — mesures, comparaison, ciné, MPR** (moteur Cornerstone uniquement ; dwv
  inchangé, flag toujours off par défaut) :
  - Distance, angle et Cobb en calque SVG, coordonnées patient (mm / °),
    **non persistées** (pas de table, pas de PHI dans le libellé).
  - Ciné (~8 images/s) sur une série de plus d'une coupe.
  - Comparaison : second viewport, défilement et fenêtrage synchronisés,
    choix de la série comparée. Ligne de référence (intersection des plans)
    quand l'orientation patient est présente et les plans ne sont pas parallèles.
  - MPR : bouton actif seulement si `isValidVolume` (orientation, taille et
    espacement homogènes) ; trois vues axial / sagittal / coronal. Sinon le
    bouton reste inactif.
  - Comparaison : chaque viewport a son overlay (série, coupe, W/L). Un échec
    de la série comparée s'affiche dans son panneau au lieu d'un viewport vide.

## 0.15.0

- **U1 — moteur Cornerstone3D derrière le contrat** (`DicomViewerProps` inchangé) :
  - Capability `engine: 'dwv' | 'cornerstone'` (défaut **`dwv`**) +
    `cornerstoneWasmBasePath` (`/cornerstone/`) ; `parseViewerEngine()` pour le
    flag app `NEXT_PUBLIC_IMAGING_ENGINE`.
  - `DicomViewer` = switch moteur : host dwv historique (`DicomViewerDwv`) ou
    host Cornerstone chargé en **dynamic import** (`DicomViewerCornerstone`,
    subpath `/engine-cs`). Erreur de chunk / init → **repli dwv** (télémétrie
    `series_open_ms` `outcome: fallback`, `reason: engine_unavailable`).
  - Chrome partagé `DicomViewerChrome` (header, rail, toolbar, overlay, slider,
    mention) — identique pour les deux moteurs.
  - Engine : `StackViewport` `wadouri:` sur URLs signées, préchargement borné
    (`maxPoolLoadConcurrency`), fichiers illisibles ignorés à la navigation,
    W/L / invert / flip / zoom / presets / Auto via `viewport.setProperties` /
    `setCamera`. Orientations hétérogènes acceptées → **plus de pool séquentiel
    ni de repli OpenJPEG** sur ce moteur. `useLegacyMetadataProvider: true`
    (provider « naturalized » 5.x perd le pixel data sous préchargement concurrent).
  - Assets : `assets/cornerstone/*.wasm` (OpenJPEG, CharLS JPEG-LS, libjpeg-turbo,
    OpenJPH) → `public/cornerstone/` via `imaging-viewer:sync` ; préfixe public
    `CORNERSTONE_PUBLIC_DIR` hors auth middleware. Worker bundlé par Next.
  - Télémétrie : `engine: 'cornerstone'` accepté (`ImagingTelemetryEngine`).
  - Gestes pointeur **sans** `@cornerstonejs/tools` (`interaction.ts`) : le worker
    `computeWorker` de tools bloque le build Turbopack et U1 n'a besoin que de
    fenêtrage / zoom / pan / coupes. Peer deps optionnelles
    `@cornerstonejs/core` + `@cornerstonejs/dicom-image-loader` ^5.10.
  - Next : alias Turbopack `fs` → module vide (`lib/imaging/empty-module.ts`) —
    les glues Emscripten `@cornerstonejs/codec-*` référencent `fs` (branche Node).
- dwv : **fix** « Réinitialiser » après un miroir laissait un canvas noir ;
  outil initial tactile (`ZoomAndPan`) posé par le host au lieu d'un reset forcé.
- Script `sync-imaging-viewer-package.mjs --tracker-only` : MANIFEST + `public/`
  tracker sans sibling Q.

## 0.14.0

- **U0 — quick wins UX** (host dwv **et** repli OpenJPEG, parité Marcel / clinicien) :
  - **Rail séries** (`DicomSeriesRail`) : colonne desktop + sheet mobile, saut
    direct vers une série (libellé, badge modality, nb fichiers). Contrat :
    `ImagingSeries.modality` / `.description`, prop `onSelectSeries` (+ `modality`).
  - **Molette = coupes** quel que soit l'outil (`accumulateWheelSlices`, seuil
    trackpad) ; outil « Coupes » réservé au tactile. Repli OpenJPEG : molette =
    coupes, Ctrl/⌘ + molette = zoom.
  - **Slider de coupes** (`DicomSliceSlider`) + raccourcis Home / End / PageUp /
    PageDown, `I` inverser, `H` miroir horizontal, `R` réinitialiser.
  - **Presets fenêtrage par modality** (`windowPresetsForModality`) : HU
    seulement sur CT ; bouton **Auto** = W/L DICOM (`resetWindowLevel`). La
    modality est lue depuis dwv (`readModality`) puis depuis la série.
  - **Inverser** (`toggleInvert`, colour map `invPlain`) et **miroir** (`flipViewLayer`).
  - **Overlay 4 coins** (`DicomCornerOverlay`, non-PHI) : modality · description,
    coupe n / N, W/L courant (`wlchange`), badge « Inversé ».
  - Mention `VIEWER_INFORMATIVE_NOTICE` (consultation, pas de diagnostic) sous le viewport.
  - Repli OpenJPEG : header `DicomSeriesHeader` partagé, rail + nav séries,
    slider, invert, overlay.
- Engine : `setSliceIndex`, `readWindowLevel`, `readModality`, `resetWindowLevel`,
  `toggleInvert`, `flipViewLayer` exportés depuis `/engine`.

## 0.13.3

- P7 residual polish (lane A) :
  - `studyAsyncExpiredMessage()` (410 / TTL 2 h)
  - `ImagingDownloadStatus` : barre dès le début multi-lots (async / chunked)
  - Apps : cron cleanup Storage TTL (tracker) — voir runbook

## 0.13.2

- MP4 prod readiness (docs / contrat) :
  - `mp4Native` documenté comme **ops flip** (Marcel + clinicien) — default
    package `false` ; flag `NEXT_PUBLIC_ENABLE_MP4_VIEWER` ou alias
    `NEXT_PUBLIC_MP4_VIEWER=1`
  - Commentaire `ViewerCapabilities.mp4Native` aligné (parité clinicien)

## 0.13.0

- P7 (apps + docs package) :
  - Export étude **async durable** — job Storage + poll/build + signed URL TTL
    (Fatima-scale) ; télémétrie `dicom_export` reasons `study_async*`
  - UX export : mode `async` dans `ExportProgressLike` / messages multi-lots
  - Parité **mp4Native** clinicien (staging / preview / flag, comme Marcel)

## 0.12.0

- P8 observabilité actionable :
  - Raisons `dicom_export` stables (`DICOM_EXPORT_REASONS`) dont réservées
    async P7 (`study_async`, `study_async_fail`, `study_async_timeout`)
  - Seuils d’alerte documentés (`IMAGING_TELEMETRY_ALERT_THRESHOLDS`)
  - `buildImagingTelemetryContractSummary()` pour ops /
    `GET /api/internal/imaging/telemetry-summary` (contrat, pas de PHI)
  - Prefixe analytics `imaging_` + helper `imagingTelemetryAnalyticsEventName`

## 0.11.0

- P6a UX polish (card-actions / grille) :
  - `ImagingGridEmptyState` + `ImagingGridLoadingState` (squelette grille)
  - `ImagingDownloadStatus` — bannière visible pendant export série/étude/lots
  - Messages export (`studyChunkedSuccessMessage`, progress multi-ZIP, fallback
    study_too_large)
  - Menu carte : spinner `downloadBusy`, cibles mobile 48px / pictogrammes densifiés
  - Dialog portée : `busyMessage` pendant le stream ZIP

## 0.10.1

- P6b : `deleteReservedHint` sur `ImagingCardActionMenu` — message non
  actionnable dans le menu ⋯ quand la suppression reste SoT Marcel
  (clinicien). Pas de contrôle poubelle factice.

## 0.10.0

- P5 : événement télémétrie non-PHI `dicom_export` (série / étude single /
  étude multi-parties) — `reason` snake_case (`series`, `study_single`,
  `study_chunked`, `*_fail`).
- Docs roadmap : export étude chunked côté apps (plan + `?part=N`).

## 0.9.2

- Grid UX : menu carte (⋯ mobile), dialog portée téléchargement série/étude,
  confirm delete typé ; barrel `/ui/card-actions` sans tirer dwv.

## 0.9.0 / 0.9.1

- Actions carte Imaging (download scope + delete confirm) sous `/ui` ;
  0.9.1 isole `card-actions` pour le listing.

## 0.8.0

- Export DICOM desktop (P0/P1 UI) : boutons chrome
  « Télécharger la série » / « Étude » via callbacks optionnels
  `onDownloadSeries` / `onDownloadStudy` (+ `downloadBusy`).
- Package reste sans auth / Storage — apps streamnent le ZIP `.dcm` brut.

## 0.7.0

- P4 : feature flags capabilities documentés —
  `encapsulatedPdf`, `mp4Native` (+ openjpeg / pixel gate déjà présents).
- Helper `resolveViewerCapabilities(overrides?)` pour fusion shallow app/package.
- Prop optionnelle `capabilities` sur `DicomViewer` : si
  `jpeg2000OpenJpegFallback: false`, le callback OpenJPEG n’est pas branché.
- P4∥ export DICOM desktop : boutons chrome « Télécharger la série » / « Étude »
  via `onDownloadSeries` / `onDownloadStudy` (+ `downloadBusy`) — ZIP brut
  via adapters app (Horos / RadiAnt / OsiriX / Weasis).

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
