# Codec assets — SoT

Binaires servis par les apps sous `public/dwv-workers` et `public/openjpeg`.

| Chemin | Rôle |
|--------|------|
| `dwv-workers/*.worker.min.js` | Workers dwv 0.36 (JPEG-LS, J2K, RLE, …) |
| `openjpeg/openjpegjs.js` | Fallback decode JPEG 2000 (OpenJPEG wasm glue) |
| `MANIFEST.json` | sha256 par fichier — régénéré par `imaging-viewer:sync` |

## Discipline

1. Remplacer un binaire **ici** uniquement (tracker SoT).
2. `npm run imaging-viewer:sync` — recalcule MANIFEST, copie vers `public/`
   tracker + questionnaires, pin le package Q.
3. `npm run imaging-viewer:check` — échoue si `public/` ou pin Q dérive.

Rewrite Next `/_next/.../assets/workers` → `/dwv-workers` : logique SoT dans
`src/worker-rewrite.ts` (`@franchir/imaging-viewer/worker-rewrite`) ; les apps
n’ont que des adapters `proxy.ts` / `next.config`.
