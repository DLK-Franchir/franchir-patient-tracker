/**
 * Contrat public visionneuse — types stables pour tracker + questionnaires.
 * Orchestration dwv (stack/pool/sequential) vit dans ce package (P1) ;
 * chrome React (toolbar, overlays) reste dans les apps.
 */

/** Une série affichable (URLs signées déjà résolues). */
export type ImagingSeries = {
  id: string
  label: string
  urls: string[]
  /** Nombre de fichiers DICOM dans le groupe (peut différer du nombre de coupes dwv). */
  fileCount: number
}

/** Alias historique apps (`ViewerSeries`). */
export type ViewerSeries = ImagingSeries

/** Fichier unitaire dans une série (métadonnées listing optionnelles). */
export type ImagingViewerItem = {
  url: string
  name?: string
  sizeBytes?: number
}

export type DicomTool = 'WindowLevel' | 'ZoomAndPan' | 'Scroll'

export type DwvLoadEvent = {
  loaded?: number
  total?: number
  error?: { message?: string } | string
}

export type ViewerStatus = 'loading' | 'rendering' | 'ready' | 'error'

export type ViewerInfoKind =
  | 'loading'
  | 'single'
  | 'stack'
  | 'partial'
  | 'sequential'
  | 'error'

export type NavMode = 'stack' | 'sequential'

export type PoolEntryStatus = 'loading' | 'ready' | 'error'

/**
 * Entrée pool séquentiel. `TApp` = type dwv `App` côté app (évite dépendance dwv ici).
 */
export type ImagingPoolEntry<TApp = unknown> = {
  app: TApp
  container: HTMLDivElement
  layerGroupId: string
  status: PoolEntryStatus
  errorMessage?: string
}

/** Alias historique. */
export type PoolEntry<TApp = unknown> = ImagingPoolEntry<TApp>

/** Capacités / plafonds produit (documentés + consommés par les apps). */
export type ViewerCapabilities = {
  maxSequentialPool: number
  maxPoolLoadConcurrency: number
  stackMode: boolean
  sequentialMode: boolean
  jpeg2000OpenJpegFallback: boolean
  pixelSignalGate: boolean
}

/** Props shell React (contrat ; chrome UI reste dans les apps en P1). */
export type DicomViewerProps = {
  urls: string[]
  name: string
  embedded?: boolean
  fullscreen?: boolean
  series?: ImagingSeries[]
  activeSeriesIndex?: number
  onNextSeries?: () => void
  onPrevSeries?: () => void
  onClose?: () => void
  onSliceCountResolved?: (count: number) => void
  /** Appelé quand dwv ne sait pas décoder le JPEG 2000 (→ repli OpenJPEG). */
  onJpeg2000Unsupported?: () => void
}

/** Surface dwv minimale pour les helpers layout (pas d'import `dwv`). */
export type DwvLayoutApp = {
  getDataIds(): string[]
  render(dataId: string): void
  fitToContainer(): void
  onResize(): void
}
