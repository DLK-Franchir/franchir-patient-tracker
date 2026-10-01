import { describe, expect, it } from 'vitest'
import {
  viewerMobileHint,
  viewerShortcutChips,
  viewerShortcutHelp,
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

describe('viewerShortcutHelp', () => {
  it('fenêtrage : titre + phrase + puces explicites', () => {
    const help = viewerShortcutHelp({
      tool: 'WindowLevel',
      mode: 'stack',
      hasSlices: true,
    })
    expect(help.title).toMatch(/Fenêtrage/i)
    expect(help.summary).toMatch(/contraste|éclaircir|assombrir/i)
    expect(help.chips.some(c => /contraste/.test(c.label))).toBe(true)
    expect(help.chips.some(c => c.keys === 'Molette' && /coupe/.test(c.label))).toBe(true)
    expect(help.chips.some(c => c.keys === 'I' && /inverse/.test(c.label))).toBe(true)
  })

  it('zoom : explique Maj pour déplacer', () => {
    const help = viewerShortcutHelp({
      tool: 'ZoomAndPan',
      mode: 'stack',
      hasSlices: true,
    })
    expect(help.title).toMatch(/Zoom/i)
    expect(help.summary).toMatch(/Maj/i)
    expect(help.chips.some(c => /Maj \+ glisser/.test(c.keys))).toBe(true)
  })

  it('MPR : coupes liées + Échap', () => {
    const help = viewerShortcutHelp({
      tool: 'WindowLevel',
      mode: 'mpr',
      hasSlices: true,
    })
    expect(help.title).toMatch(/MPR|3 vues/i)
    expect(help.chips.map(c => c.label).join(' · ')).toMatch(/3 vues/)
    expect(help.chips.some(c => c.keys === 'Échap')).toBe(true)
  })

  it('viewerShortcutChips délègue à help.chips', () => {
    const input = { tool: 'WindowLevel' as const, mode: 'stack' as const, hasSlices: false }
    expect(viewerShortcutChips(input)).toEqual(viewerShortcutHelp(input).chips)
  })
})
