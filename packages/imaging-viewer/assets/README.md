# Codec assets — SoT

Binaires servis par les apps sous `public/dwv-workers` et `public/openjpeg`.

| Chemin | Rôle |
|--------|------|
| `dwv-workers/*.worker.min.js` | Workers dwv 0.36 (JPEG-LS, J2K, RLE, …) |
| `openjpeg/openjpegjs.js` | Fallback decode JPEG 2000 (OpenJPEG wasm glue) |
| `cornerstone/*.wasm` | Codecs decode `@cornerstonejs/dicom-image-loader` 5.x (OpenJPEG J2K, CharLS JPEG-LS, libjpeg-turbo, OpenJPH HTJ2K) — servis via `wasmBasePath` `/cornerstone/` (U1) |
| `MANIFEST.json` | sha256 par fichier — régénéré par `imaging-viewer:sync` |

Les `.wasm` Cornerstone sont copiés depuis `node_modules/@cornerstonejs/codec-*/dist/*_decode.wasm`
(+ `openjphjs.wasm`) à la version pinée dans `package.json` (`peerDependencies`).
Le worker de décodage (`decodeImageFrameWorker.js`) est bundlé par Next / Vite
(`new Worker(new URL(..., import.meta.url))`) — pas de copie manuelle.

## Discipline

1. Remplacer un binaire **ici** uniquement (tracker SoT).
2. `npm run imaging-viewer:sync` — recalcule MANIFEST, copie vers `public/`
   tracker + questionnaires, pin le package Q.
3. `npm run imaging-viewer:check` — échoue si `public/` ou pin Q dérive.

Rewrite Next `/_next/.../assets/workers` → `/dwv-workers` : logique SoT dans
`src/worker-rewrite.ts` (`@franchir/imaging-viewer/worker-rewrite`) ; les apps
n’ont que des adapters `proxy.ts` / `next.config`.
