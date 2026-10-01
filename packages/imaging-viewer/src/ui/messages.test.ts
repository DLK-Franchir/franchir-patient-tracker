import { describe, expect, it } from 'vitest'
import {
  viewerMobileHint,
  viewerShortcutChips,
  viewerToolHint,
  viewportLoadingMessage,
} from './messages'

describe('viewportLoadingMessage', () => {
  it('annonce le chargement de série multi-fichiers', () => {
    expect(
      viewportLoadingMessage({
        status: 'loading',
        navMode: 'stack',
        fileCount: 12,
        fileIndex: 0,
        preloadLoaded: 0,
      })
    ).toBe('Chargement de la série (12 fichiers)…')
  })

  it('annonce le préchargement sequential', () => {
    expect(
      viewportLoadingMessage({
        status: 'rendering',
        navMode: 'sequential',
        fileCount: 8,
        fileIndex: 2,
        preloadLoaded: 3,
      })
    ).toBe('Préchargement des images (3/8)…')
  })
})

describe('viewer hints', () => {
  it('annonce molette = coupes en sequential comme en stack (U0)', () => {
    expect(
      viewerToolHint({
        navMode: 'sequential',
        fileCount: 5,
        tool: 'WindowLevel',
        sliceCount: 1,
      })
    ).toMatch(/molette ou ← → : coupes/)
    expect(
      viewerToolHint({ navMode: 'stack', fileCount: 20, tool: 'WindowLevel', sliceCount: 20 })
    ).toMatch(/molette ou ← → : coupes/)
  })

  it('outil Zoom : molette et glisser zooment', () => {
    expect(
      viewerToolHint({ navMode: 'stack', fileCount: 20, tool: 'ZoomAndPan', sliceCount: 20 })
    ).toMatch(/molette : zoom/)
  })

  it('ne parle pas de coupes sur une image unique', () => {
    expect(
      viewerToolHint({ navMode: 'stack', fileCount: 1, tool: 'WindowLevel', sliceCount: 1 })
    ).not.toMatch(/coupes/)
  })

  it('mobile hint zoom', () => {
    expect(viewerMobileHint({ tool: 'ZoomAndPan', sliceCount: 1 })).toMatch(/zoomer/)
  })
})

describe('viewerShortcutChips', () => {
  it('fenêtrage : contraste, coupes, I, H', () => {
    const chips = viewerShortcutChips({
      tool: 'WindowLevel',
      mode: 'stack',
      hasSlices: true,
    })
    expect(chips.map(c => `${c.keys}:${c.label}`)).toEqual([
      'Glisser:contraste',
      'Molette:coupes',
      'I:inverser',
      'H:miroir',
    ])
  })

  it('zoom : glisser/molette zoom + Maj déplacer', () => {
    const chips = viewerShortcutChips({
      tool: 'ZoomAndPan',
      mode: 'stack',
      hasSlices: true,
    })
    expect(chips).toEqual(
      expect.arrayContaining([
        { keys: 'Glisser', label: 'zoom' },
        { keys: 'Molette', label: 'zoom' },
        { keys: 'Maj+glisser', label: 'déplacer' },
        { keys: 'Maj+molette', label: 'déplacer' },
      ])
    )
  })

  it('MPR : coupes liées + Échap', () => {
    const chips = viewerShortcutChips({
      tool: 'WindowLevel',
      mode: 'mpr',
      hasSlices: true,
    })
    expect(chips.map(c => c.label).join(' · ')).toMatch(/coupes liées/)
    expect(chips.some(c => c.keys === 'Échap')).toBe(true)
  })

  it('JPEG 2000 signale mesures / MPR indisponibles', () => {
    const chips = viewerShortcutChips({
      tool: 'WindowLevel',
      mode: 'jpeg2000',
      hasSlices: false,
    })
    expect(chips.some(c => /indisponibles/.test(c.label))).toBe(true)
  })

  it('sans coupes : pas de puce molette=coupes en stack', () => {
    const chips = viewerShortcutChips({
      tool: 'WindowLevel',
      mode: 'stack',
      hasSlices: false,
    })
    expect(chips.some(c => c.keys === 'Molette' && c.label === 'coupes')).toBe(false)
  })
})
