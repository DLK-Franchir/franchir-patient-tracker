/**
 * Initialisation Cornerstone3D (U1) — singleton idempotent, client only.
 * Les `.wasm` codecs sont servis depuis `public/cornerstone/` (assets SoT),
 * le worker de décodage est bundlé (`new Worker(new URL(..., import.meta.url))`).
 */

import * as csCore from '@cornerstonejs/core'
import * as csTools from '@cornerstonejs/tools'
import * as dicomImageLoader from '@cornerstonejs/dicom-image-loader'

export type CornerstoneInitOptions = {
  wasmBasePath: string
  maxWebWorkers?: number
  /** Plafond cache images (octets). Défaut 1 Go — CD patient, pas de PACS. */
  maxCacheBytes?: number
}

export const CS_TOOL_NAMES = {
  windowLevel: csTools.WindowLevelTool.toolName,
  pan: csTools.PanTool.toolName,
  zoom: csTools.ZoomTool.toolName,
  stackScroll: csTools.StackScrollTool.toolName,
} as const

const DEFAULT_MAX_CACHE_BYTES = 1024 * 1024 * 1024

let initPromise: Promise<void> | null = null

function addToolOnce(tool: Parameters<typeof csTools.addTool>[0]) {
  try {
    csTools.addTool(tool)
  } catch {
    /* déjà enregistré (HMR / plusieurs hosts) */
  }
}

/**
 * Prépare core + tools + loader. Résout une seule fois par page ; en cas
 * d'échec (WebGL indisponible…) la promesse est rejetée et retentée à l'appel
 * suivant.
 */
export function ensureCornerstone(options: CornerstoneInitOptions): Promise<void> {
  if (initPromise) return initPromise
  initPromise = (async () => {
    if (typeof window === 'undefined') {
      throw new Error('Cornerstone3D ne s’initialise que côté navigateur')
    }
    if (!csCore.isCornerstoneInitialized()) {
      csCore.init()
    }
    csTools.init()
    dicomImageLoader.init({
      maxWebWorkers: options.maxWebWorkers,
      wasmBasePath: options.wasmBasePath,
      // Miroir de `wasmBasePath` pour le worker (résolution côté worker).
      decodeConfig: { wasmBasePath: options.wasmBasePath },
      // Chemin dicom-parser historique (dataSetCacheManager) : le provider
      // « naturalized » 5.x perd COMPRESSED_FRAME_DATA sous préchargement
      // concurrent (observé : fichiers 6+ d'une série de 12 rejetés).
      useLegacyMetadataProvider: true,
    })
    csCore.cache.setMaxCacheSize(options.maxCacheBytes ?? DEFAULT_MAX_CACHE_BYTES)
    addToolOnce(csTools.WindowLevelTool)
    addToolOnce(csTools.PanTool)
    addToolOnce(csTools.ZoomTool)
    addToolOnce(csTools.StackScrollTool)
  })()
  initPromise.catch(() => {
    initPromise = null
  })
  return initPromise
}

/** Tests / HMR : oublie l'état d'init mémorisé (ne détruit pas Cornerstone). */
export function resetCornerstoneInitForTests(): void {
  initPromise = null
}
