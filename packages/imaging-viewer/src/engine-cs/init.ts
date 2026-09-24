/**
 * Initialisation Cornerstone3D (U1) — singleton idempotent, client only.
 * Les `.wasm` codecs sont servis depuis `public/cornerstone/` (assets SoT),
 * le worker de décodage est bundlé (`new Worker(new URL(..., import.meta.url))`).
 *
 * Pas de `@cornerstonejs/tools` : les gestes sont dans `interaction.ts` et les
 * mesures U2 sont un calque SVG (le worker `computeWorker` de tools bloque Turbopack).
 */

import * as csCore from '@cornerstonejs/core'
import * as dicomImageLoader from '@cornerstonejs/dicom-image-loader'

export type CornerstoneInitOptions = {
  wasmBasePath: string
  maxWebWorkers?: number
  /** Plafond cache images (octets). Défaut 1 Go — CD patient, pas de PACS. */
  maxCacheBytes?: number
}

const DEFAULT_MAX_CACHE_BYTES = 1024 * 1024 * 1024

let initPromise: Promise<void> | null = null

/**
 * Prépare core + loader. Résout une seule fois par page ; en cas d'échec
 * (WebGL indisponible…) la promesse est rejetée et retentée à l'appel suivant.
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
    // Le MPR utilise `cornerstoneStreamingImageVolume:` — loader par défaut
    // de Cornerstone quand aucun scheme n'est enregistré.
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
