import type { DicomTool, NavMode, ViewerStatus } from '../contract'

/** Message overlay viewport pendant load / rendering. */
export function viewportLoadingMessage(input: {
  status: ViewerStatus
  navMode: NavMode
  fileCount: number
  fileIndex: number
  preloadLoaded: number
}): string {
  const { status, navMode, fileCount, fileIndex, preloadLoaded } = input

  if (status === 'rendering' && navMode === 'sequential' && fileCount > 1) {
    return preloadLoaded < fileCount
      ? `Préchargement des images (${preloadLoaded}/${fileCount})…`
      : `Chargement du fichier ${fileIndex + 1}/${fileCount}…`
  }
  if (status === 'rendering') return "Rendu de l'image…"
  if (navMode === 'sequential' && fileCount > 1 && preloadLoaded > 0) {
    return `Préchargement des images (${preloadLoaded}/${fileCount})…`
  }
  if (fileCount > 1 && preloadLoaded > 0 && navMode === 'stack') {
    return `Préchargement des images (${preloadLoaded}/${fileCount})…`
  }
  if (fileCount > 1) return `Chargement de la série (${fileCount} fichiers)…`
  return "Chargement de l'image…"
}

export function viewerToolHint(input: {
  navMode: NavMode
  fileCount: number
  tool: DicomTool
  sliceCount: number
}): string {
  const { navMode, fileCount, tool, sliceCount } = input
  const hasSlices = sliceCount > 1 || (navMode === 'sequential' && fileCount > 1)
  const scrollHint = hasSlices ? ' · molette ou ← → : coupes' : ''
  if (tool === 'ZoomAndPan') {
    return `Glisser : zoom · Maj+glisser : déplacer · molette : zoom${
      hasSlices ? ' · fenêtrage pour les coupes' : ''
    }`
  }
  if (tool === 'Scroll') {
    return 'Glisser ou molette : changer de coupe'
  }
  return `Glisser : fenêtrage${scrollHint} · I : inverser`
}

export function viewerMobileHint(input: { tool: DicomTool; sliceCount: number }): string {
  const { tool, sliceCount } = input
  if (tool === 'ZoomAndPan') {
    return 'Glissez pour zoomer · Maj+glisser pour déplacer · molette : zoom'
  }
  if (tool === 'Scroll' && sliceCount > 1) {
    return 'Balayez ou utilisez le curseur pour changer de coupe'
  }
  if (sliceCount > 1) {
    return 'Curseur ou Préc./Suiv. : coupes · Zoom pour agrandir'
  }
  return "Choisissez Zoom pour agrandir l'image"
}

/** Mode chrome pour la bulle de raccourcis (indépendant de NavMode moteur). */
export type ViewerShortcutMode = 'stack' | 'compare' | 'mpr' | 'jpeg2000'

export type ViewerShortcutChip = {
  /** Libellé clavier / geste affiché en `kbd` contrasté. */
  keys: string
  /** Action associée. */
  label: string
}

/**
 * Puces de raccourcis dynamiques selon outil + mode.
 * Texte déterministe, sans PHI — tests vitest sur le contenu.
 */
export function viewerShortcutChips(input: {
  tool: DicomTool
  mode: ViewerShortcutMode
  hasSlices: boolean
}): ViewerShortcutChip[] {
  const { tool, mode, hasSlices } = input

  if (mode === 'mpr') {
    const chips: ViewerShortcutChip[] = [
      { keys: 'Molette', label: 'coupes liées (3 vues)' },
      { keys: 'Zoom', label: 'zoom sur la vue' },
      { keys: 'Échap', label: 'quitter le MPR' },
    ]
    if (tool === 'WindowLevel') {
      chips.unshift({ keys: 'Glisser', label: 'contraste' })
    }
    if (tool === 'ZoomAndPan') {
      chips.unshift({ keys: 'Glisser', label: 'zoom' })
      chips.splice(2, 0, { keys: 'Maj+glisser', label: 'déplacer' })
    }
    return chips
  }

  if (tool === 'ZoomAndPan') {
    const chips: ViewerShortcutChip[] = [
      { keys: 'Glisser', label: 'zoom' },
      { keys: 'Molette', label: 'zoom' },
      { keys: 'Maj+glisser', label: 'déplacer' },
      { keys: 'Maj+molette', label: 'déplacer' },
    ]
    if (mode === 'compare') {
      chips.push({ keys: 'Comparer', label: 'défilement synchronisé' })
    }
    if (mode === 'jpeg2000') {
      chips.push({ keys: 'Mesures / MPR', label: 'indisponibles' })
    }
    return chips
  }

  if (tool === 'Scroll') {
    return [
      { keys: 'Glisser', label: 'coupes' },
      { keys: 'Molette', label: 'coupes' },
    ]
  }

  // Fenêtrage (défaut) et autres outils de lecture
  const chips: ViewerShortcutChip[] = [{ keys: 'Glisser', label: 'contraste' }]
  if (hasSlices || mode === 'compare') {
    chips.push({ keys: 'Molette', label: mode === 'compare' ? 'coupes synchronisées' : 'coupes' })
  }
  chips.push({ keys: 'I', label: 'inverser' }, { keys: 'H', label: 'miroir' })
  if (mode === 'jpeg2000') {
    chips.push({ keys: 'Mesures / MPR', label: 'indisponibles' })
  }
  if (mode === 'compare' && tool === 'WindowLevel') {
    chips.push({ keys: 'Comparer', label: 'W/L synchronisé' })
  }
  return chips
}

/** Accent teal Franchir (hex — indépendant des tokens Tailwind app). */
export const VIEWER_ACCENT = '#38B2AC'
export const VIEWER_BG = '#0B1020'
