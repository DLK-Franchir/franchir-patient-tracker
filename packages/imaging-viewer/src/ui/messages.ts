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
  if (navMode === 'sequential' && fileCount > 1) {
    return '← → : fichier précédent / suivant'
  }
  if (tool === 'Scroll' && sliceCount > 1) {
    return 'Molette ou ← → : changer de coupe'
  }
  if (tool === 'ZoomAndPan') {
    return 'Glisser : déplacer · pincement ou +/- : zoom'
  }
  return 'Glisser : ajuster le fenêtrage (activez Coupes pour naviguer)'
}

export function viewerMobileHint(input: {
  tool: DicomTool
  sliceCount: number
}): string {
  const { tool, sliceCount } = input
  if (tool === 'ZoomAndPan') {
    return 'Pincez ou utilisez +/- pour zoomer · glissez pour déplacer'
  }
  if (tool === 'Scroll' && sliceCount > 1) {
    return 'Balayez ou utilisez Préc./Suiv. pour changer de coupe'
  }
  return "Choisissez Zoom pour agrandir l'image"
}

/** Accent teal Franchir (hex — indépendant des tokens Tailwind app). */
export const VIEWER_ACCENT = '#38B2AC'
export const VIEWER_BG = '#0B1020'
