import { describe, expect, it } from 'vitest'
import {
  viewerMobileHint,
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
      }),
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
      }),
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
      }),
    ).toMatch(/molette ou ← → : coupes/)
    expect(
      viewerToolHint({ navMode: 'stack', fileCount: 20, tool: 'ZoomAndPan', sliceCount: 20 }),
    ).toMatch(/molette ou ← → : coupes/)
  })

  it('ne parle pas de coupes sur une image unique', () => {
    expect(
      viewerToolHint({ navMode: 'stack', fileCount: 1, tool: 'WindowLevel', sliceCount: 1 }),
    ).not.toMatch(/coupes/)
  })

  it('mobile hint zoom', () => {
    expect(viewerMobileHint({ tool: 'ZoomAndPan', sliceCount: 1 })).toMatch(/zoomer/)
  })
})
