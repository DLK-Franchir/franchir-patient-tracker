import type { NavMode, ViewerCapabilities, ViewerInfoKind, ViewerStatus } from './contract'

/**
 * Presets fenêtrage en unités Hounsfield — pertinents uniquement pour le
 * scanner (CT). Sur IRM / radio ils n'ont pas de sens : masqués (U0).
 */
export const WL_PRESETS = [
  { id: 'soft', label: 'Tissus mous', center: 40, width: 400 },
  { id: 'bone', label: 'Os', center: 300, width: 1500 },
  { id: 'brain', label: 'Cerveau', center: 40, width: 80 },
] as const

export type WlPresetId = (typeof WL_PRESETS)[number]['id']

/** Modalités pour lesquelles les presets HU sont proposés. */
export const HU_PRESET_MODALITIES: readonly string[] = ['CT']

/** Normalise une modality DICOM (`' mr '` → `'MR'`), `null` si vide. */
export function normalizeModality(modality: string | null | undefined): string | null {
  const key = (modality ?? '').trim().toUpperCase()
  return key.length > 0 ? key : null
}

/**
 * Presets à afficher pour la modality ouverte. Inconnue → aucun preset HU
 * (le bouton « Auto » reste toujours disponible).
 */
export function windowPresetsForModality(
  modality: string | null | undefined
): readonly (typeof WL_PRESETS)[number][] {
  const key = normalizeModality(modality)
  if (!key) return []
  return HU_PRESET_MODALITIES.includes(key) ? WL_PRESETS : []
}

/** Seuil deltaY (px) cumulé avant de changer de coupe au trackpad. */
export const WHEEL_SLICE_STEP_PX = 24
/** Au-delà, un événement seul est un cran de souris : exactement une coupe. */
export const WHEEL_NOTCH_PX = 50

/**
 * Convertit un événement molette en nombre de coupes (signé) + reste cumulé.
 * - `deltaMode` ligne/page (Firefox) ou cran souris (|deltaY| ≥ `WHEEL_NOTCH_PX`)
 *   → **une** coupe par cran (Horos / RadiAnt), reste remis à zéro.
 * - Petits deltas trackpad → cumul jusqu'au seuil `WHEEL_SLICE_STEP_PX`.
 */
export function accumulateWheelSlices(
  accumulated: number,
  deltaY: number,
  deltaMode: number = 0,
  stepPx: number = WHEEL_SLICE_STEP_PX
): { steps: number; remainder: number } {
  if (!Number.isFinite(deltaY) || deltaY === 0) return { steps: 0, remainder: accumulated }
  if (deltaMode !== 0 || Math.abs(deltaY) >= WHEEL_NOTCH_PX) {
    return { steps: deltaY > 0 ? 1 : -1, remainder: 0 }
  }
  const total = accumulated + deltaY
  const steps = Math.trunc(total / stepPx)
  return { steps, remainder: total - steps * stepPx }
}

/** Mention affichée dans le chrome : visionneuse de consultation, pas de diagnostic. */
export const VIEWER_INFORMATIVE_NOTICE =
  'Visualisation à titre informatif — ne remplace pas la lecture diagnostique.'

/** Texte overlay W/L (arrondi, unités libres : HU pour CT, valeurs brutes sinon). */
export function formatWindowLevelOverlay(
  wl: { center: number; width: number } | null | undefined
): string | null {
  if (!wl || !Number.isFinite(wl.center) || !Number.isFinite(wl.width)) return null
  return `F ${Math.round(wl.width)} / C ${Math.round(wl.center)}`
}

/** Libellé haut-gauche overlay : `MR · SAG T2` / `CT` / description seule. */
export function formatSeriesOverlayLabel(input: {
  modality?: string | null
  description?: string | null
}): string | null {
  const modality = normalizeModality(input.modality)
  const description = (input.description ?? '').trim()
  if (modality && description) return `${modality} · ${description}`
  if (modality) return modality
  if (description) return description
  return null
}

/** Limite mémoire : une App dwv isolée par fichier en mode séquentiel. */
export const MAX_SEQUENTIAL_POOL = 50
/** Chargements dwv parallèles max (évite OOM sur séries JPEG volumineuses). */
export const MAX_POOL_LOAD_CONCURRENCY = 4

export const STACK_LOAD_FAIL_MS = 120_000
export const STACK_RENDER_READY_MS = 400
/** Delais progressifs apres load dwv (workers J2K / JPEG-LS). */
export const RENDER_READY_DELAYS_MS = [400, 800, 1500, 3000, 6000, 10000, 15000] as const
export const STACK_PROGRESS_FALLBACK_MS = 600
export const LAYOUT_RETRY_DELAYS_MS = [0, 50, 150, 400, 800] as const

export const DEFAULT_VIEWER_CAPABILITIES: ViewerCapabilities = {
  maxSequentialPool: MAX_SEQUENTIAL_POOL,
  maxPoolLoadConcurrency: MAX_POOL_LOAD_CONCURRENCY,
  stackMode: true,
  sequentialMode: true,
  jpeg2000OpenJpegFallback: true,
  pixelSignalGate: true,
  encapsulatedPdf: true,
  mp4Native: false,
}

/** Fusion shallow des overrides app sur les defaults produit. */
export function resolveViewerCapabilities(
  overrides?: Partial<ViewerCapabilities> | null
): ViewerCapabilities {
  if (!overrides) return { ...DEFAULT_VIEWER_CAPABILITIES }
  return { ...DEFAULT_VIEWER_CAPABILITIES, ...overrides }
}

/** dwv refuse d'empiler des coupes dont l'orientation ImageOrientationPatient diffère. */
export function isStackOrientationMismatch(message: string | null | undefined): boolean {
  if (!message?.trim()) return false
  const lower = message.toLowerCase()
  return (
    lower.includes('different orientation') ||
    lower.includes('orientation mismatch') ||
    lower.includes('orientations différentes')
  )
}

export const SEQUENTIAL_ORIENTATION_FALLBACK_MSG =
  "Orientations d'images incompatibles — affichage fichier par fichier."

/** Localizers / scouts sont multi-plans par nature (pas un bug de regroupement). */
export const SEQUENTIAL_LOCALIZER_ORIENTATION_MSG =
  'Localizer multi-plans (même série DICOM) — coupes AX/SAG/COR attendues, affichage fichier par fichier.'

export function orientationFallbackMessage(seriesName?: string | null): string {
  if (seriesName && /localizer|localiser|scout|survey/i.test(seriesName)) {
    return SEQUENTIAL_LOCALIZER_ORIENTATION_MSG
  }
  return SEQUENTIAL_ORIENTATION_FALLBACK_MSG
}

/**
 * Le décodeur JPEG 2000 de dwv (portage PDF.js) rejette certaines options de
 * codage (« selective arithmetic coding bypass », marqueur COD) utilisées par
 * des radios DX. Dans ce cas on bascule vers le viewer de repli OpenJPEG.
 */
export function isUnsupportedJpeg2000Error(message: string | null | undefined): boolean {
  if (!message?.trim()) return false
  const lower = message.toLowerCase()
  return (
    lower.includes('jpx') ||
    lower.includes('selectivearithmeticcodingbypass') ||
    (lower.includes('unsupported') && lower.includes('cod options'))
  )
}

/** Messages utilisateur pour échecs dwv / transfer syntax non supportée. */
export function formatDicomLoadError(message: string | null | undefined): string {
  if (!message?.trim()) {
    return 'format non pris en charge, fichier corrompu ou lien expiré'
  }
  const lower = message.toLowerCase()
  if (
    lower.includes('invalidjwt') ||
    lower.includes('"exp" claim') ||
    lower.includes('jwt expired') ||
    (lower.includes('400') && lower.includes('storage'))
  ) {
    return 'Lien imagerie expiré — fermez la visionneuse et rouvrez la série'
  }
  if (
    lower.includes('jpeg-ls') ||
    lower.includes('jpegls') ||
    lower.includes('1.2.840.10008.1.2.4.80') ||
    lower.includes('1.2.840.10008.1.2.4.81')
  ) {
    return 'Format DICOM non supporté (JPEG-LS) — contactez le support'
  }
  if (
    lower.includes('jpeg 2000') ||
    lower.includes('jpeg2000') ||
    lower.includes('1.2.840.10008.1.2.4.90') ||
    lower.includes('1.2.840.10008.1.2.4.91')
  ) {
    return 'Format DICOM non supporté (JPEG 2000) — contactez le support'
  }
  if (
    lower.includes('jpeg lossless') ||
    lower.includes('jpegloss') ||
    lower.includes('1.2.840.10008.1.2.4.70')
  ) {
    return 'Format DICOM non supporté (JPEG Lossless) — contactez le support'
  }
  if (
    lower.includes('codec') ||
    lower.includes('decompress') ||
    lower.includes('transfer syntax')
  ) {
    return 'Format DICOM non supporté — contactez le support'
  }
  if (
    lower.includes('encapsulated pdf') ||
    lower.includes('pdf encapsul') ||
    lower.includes('modality doc') ||
    lower.includes('1.2.840.10008.5.1.4.1.1.104.1')
  ) {
    return 'Format non supporté : PDF encapsulé (ouvrir via la carte document PDF)'
  }
  return message
}

let layerGroupCounter = 0

export function nextLayerGroupId(): string {
  layerGroupCounter += 1
  return `dwv-group-${layerGroupCounter}`
}

/** Reset compteur (tests uniquement). */
export function resetLayerGroupIdCounterForTests(): void {
  layerGroupCounter = 0
}

export function resolveViewerInfoKind(input: {
  isBusy: boolean
  status: ViewerStatus
  navMode: NavMode
  fileCount: number
  sliceCount: number
}): ViewerInfoKind {
  if (input.isBusy) return 'loading'
  if (input.status === 'error') return 'error'
  if (input.navMode === 'sequential' && input.fileCount > 1) return 'sequential'
  if (input.fileCount > 1 && input.sliceCount > 1 && input.fileCount > input.sliceCount) {
    return 'partial'
  }
  if (input.sliceCount > 1) return 'stack'
  return 'single'
}
