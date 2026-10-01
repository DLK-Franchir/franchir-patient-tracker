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
  /** Action associée — phrase courte, compréhensible sans jargon. */
  label: string
}

export type ViewerShortcutHelp = {
  /** Titre selon l’outil / mode actif. */
  title: string
  /** Une phrase d’intro (« à quoi sert cet outil »). */
  summary: string
  chips: ViewerShortcutChip[]
}

/**
 * Aide gestuelle dynamique selon outil + mode.
 * Phrases explicites (pas de libellés cryptiques) — tests vitest.
 */
export function viewerShortcutHelp(input: {
  tool: DicomTool
  mode: ViewerShortcutMode
  hasSlices: boolean
}): ViewerShortcutHelp {
  const { tool, mode, hasSlices } = input

  if (mode === 'mpr') {
    const chips: ViewerShortcutChip[] = [
      {
        keys: 'Molette',
        label: 'fait défiler les 3 vues en même temps (même point anatomique)',
      },
      { keys: 'Outil Zoom', label: 'glisser ou molette pour agrandir une vue' },
      { keys: 'Échap', label: 'ferme le mode 3 vues et revient à la série' },
    ]
    if (tool === 'WindowLevel') {
      chips.unshift({
        keys: 'Glisser',
        label: 'règle le contraste / luminosité sur les 3 vues',
      })
    }
    if (tool === 'ZoomAndPan') {
      chips.unshift({ keys: 'Glisser', label: 'agrandit la vue sous le curseur' })
      chips.splice(2, 0, {
        keys: 'Maj + glisser',
        label: 'déplace l’image dans la vue',
      })
    }
    return {
      title: 'Mode 3 vues (MPR)',
      summary:
        'Trois plans du volume (de face, de profil, du dessus). Les coupes restent liées.',
      chips,
    }
  }

  if (tool === 'ZoomAndPan') {
    const chips: ViewerShortcutChip[] = [
      { keys: 'Glisser', label: 'agrandit ou réduit l’image' },
      { keys: 'Molette', label: 'zoom aussi (pas de changement de coupe)' },
      { keys: 'Maj + glisser', label: 'déplace l’image (pan)' },
      { keys: 'Maj + molette', label: 'déplace verticalement' },
    ]
    if (mode === 'compare') {
      chips.push({
        keys: 'Comparer',
        label: 'les deux séries défilent ensemble',
      })
    }
    if (mode === 'jpeg2000') {
      chips.push({
        keys: 'Mesures / MPR',
        label: 'indisponibles sur ce format d’image',
      })
    }
    return {
      title: 'Outil Zoom / Déplacement',
      summary: 'Agrandissez l’image, puis maintenez Maj pour la déplacer.',
      chips,
    }
  }

  if (tool === 'Scroll') {
    return {
      title: 'Outil Coupes',
      summary: 'Balayez pour changer de coupe (tactile ou curseur).',
      chips: [
        { keys: 'Glisser', label: 'passe à la coupe précédente / suivante' },
        { keys: 'Molette', label: 'même effet que le glisser' },
      ],
    }
  }

  // Fenêtrage (défaut)
  const chips: ViewerShortcutChip[] = [
    {
      keys: 'Glisser',
      label: 'règle le contraste et la luminosité (fenêtrage)',
    },
  ]
  if (hasSlices || mode === 'compare') {
    chips.push({
      keys: 'Molette',
      label:
        mode === 'compare'
          ? 'change de coupe sur les deux séries en même temps'
          : 'change de coupe (← → et le curseur en bas aussi)',
    })
  }
  chips.push(
    { keys: 'I', label: 'inverse le noir et le blanc' },
    { keys: 'H', label: 'miroir horizontal (retourne gauche/droite)' },
  )
  if (mode === 'jpeg2000') {
    chips.push({
      keys: 'Mesures / MPR',
      label: 'indisponibles sur ce format d’image',
    })
  }
  if (mode === 'compare') {
    chips.push({
      keys: 'Comparer',
      label: 'le contraste est synchronisé entre les deux séries',
    })
  }
  return {
    title: 'Outil Fenêtrage',
    summary:
      'Cliquez-glissez sur l’image pour éclaircir / assombrir. La molette change de coupe.',
    chips,
  }
}

/** @deprecated Préférer `viewerShortcutHelp` (titre + résumé + puces). */
export function viewerShortcutChips(input: {
  tool: DicomTool
  mode: ViewerShortcutMode
  hasSlices: boolean
}): ViewerShortcutChip[] {
  return viewerShortcutHelp(input).chips
}

/** Accent teal Franchir (hex — indépendant des tokens Tailwind app). */
export const VIEWER_ACCENT = '#38B2AC'
export const VIEWER_BG = '#0B1020'
