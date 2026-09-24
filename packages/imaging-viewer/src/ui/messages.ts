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
    return `Glisser : déplacer · +/- : zoom${scrollHint}`
  }
  if (tool === 'Scroll') {
    return 'Glisser ou molette : changer de coupe'
  }
  return `Glisser : fenêtrage${scrollHint} · I : inverser`
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
    return 'Balayez ou utilisez le curseur pour changer de coupe'
  }
  if (sliceCount > 1) {
    return 'Curseur ou Préc./Suiv. : coupes · Zoom pour agrandir'
  }
  return "Choisissez Zoom pour agrandir l'image"
}

/** Accent teal Franchir (hex — indépendant des tokens Tailwind app). */
export const VIEWER_ACCENT = '#38B2AC'
export const VIEWER_BG = '#0B1020'
