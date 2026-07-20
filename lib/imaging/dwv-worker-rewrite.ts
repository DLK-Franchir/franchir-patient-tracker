/**
 * Thin adapter — SoT `@franchir/imaging-viewer/worker-rewrite`.
 * Middleware (`proxy.ts`) et tests importent depuis ici pour rester alignés Q.
 */
export {
  DWV_ASSETS_WORKERS_SEGMENT,
  DWV_NEXT_CONFIG_REWRITES,
  DWV_NEXT_WORKER_MATCHER,
  DWV_PUBLIC_PATH_PREFIXES,
  DWV_WORKERS_PUBLIC_DIR,
  OPENJPEG_PUBLIC_DIR,
  OPENJPEG_SCRIPT_URL,
  dwvWorkerRewriteTarget,
  isDwvPublicAssetPath,
} from '@franchir/imaging-viewer/worker-rewrite'
