/**
 * Chemins publics + rewrite middleware pour workers dwv 0.36 et OpenJPEG.
 *
 * dwv résout ses codec workers via `import.meta.url` du chunk Next →
 * `/_next/static/chunks/assets/workers/<file>`. Les rewrites `next.config`
 * ne s'appliquent PAS sous `/_next/*` ; le middleware doit réécrire vers
 * `/dwv-workers/<file>` (vendored dans `public/` depuis `assets/`).
 *
 * OpenJPEG (fallback J2K) est servi tel quel sous `/openjpeg/` — pas de
 * rewrite, mais le préfixe doit rester public (hors auth).
 *
 * SoT = ce module. Apps : thin adapters dans `proxy.ts` / `dwv-worker-rewrite.ts`.
 */

/** Workers codec servis depuis `public/dwv-workers/`. */
export const DWV_WORKERS_PUBLIC_DIR = '/dwv-workers'

/** Segment demandé par dwv (relatif au chunk) avant rewrite. */
export const DWV_ASSETS_WORKERS_SEGMENT = '/assets/workers'

/** Fallback OpenJPEG servi depuis `public/openjpeg/`. */
export const OPENJPEG_PUBLIC_DIR = '/openjpeg'

/** Script glue OpenJPEG (pas d'import bundlé — branche Node du glue Emscripten). */
export const OPENJPEG_SCRIPT_URL = `${OPENJPEG_PUBLIC_DIR}/openjpegjs.js`

/**
 * Préfixes à laisser publics (hors session / i18n) dans le middleware.
 * Inclut OpenJPEG pour le fallback J2K hors auth.
 */
export const DWV_PUBLIC_PATH_PREFIXES = [
  DWV_WORKERS_PUBLIC_DIR,
  DWV_ASSETS_WORKERS_SEGMENT,
  OPENJPEG_PUBLIC_DIR,
] as const

/**
 * Matcher Next middleware pour les workers demandés sous
 * `/_next/.../assets/workers/` (rewrites next.config ne couvrent pas `/_next/*`).
 */
export const DWV_NEXT_WORKER_MATCHER =
  '/_next/:path*/assets/workers/:file' as const

/**
 * Rewrites `next.config` `afterFiles` — couvrent les chemins hors `/_next/*`.
 * Le cas `/_next/.../assets/workers` reste au middleware (`DWV_NEXT_WORKER_MATCHER`).
 */
export const DWV_NEXT_CONFIG_REWRITES = [
  {
    source: '/:prefix*/assets/workers/:file',
    destination: `${DWV_WORKERS_PUBLIC_DIR}/:file`,
  },
  {
    source: '/assets/workers/:file',
    destination: `${DWV_WORKERS_PUBLIC_DIR}/:file`,
  },
] as const

const WORKER_PATH_RE = /\/assets\/workers\/([^/]+)$/

/** Mappe `.../assets/workers/<fichier>` → `/dwv-workers/<fichier>`, sinon null. */
export function dwvWorkerRewriteTarget(pathname: string): string | null {
  const match = pathname.match(WORKER_PATH_RE)
  if (!match) return null
  return `${DWV_WORKERS_PUBLIC_DIR}/${match[1]}`
}

/** True si le pathname est un asset codec public (workers ou OpenJPEG). */
export function isDwvPublicAssetPath(pathname: string): boolean {
  return DWV_PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}
