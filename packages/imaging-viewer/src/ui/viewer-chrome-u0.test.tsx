import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ImagingSeries } from '../contract'
import { WL_PRESETS } from '../policy'
import { DicomCornerOverlay } from './viewer-corner-overlay'
import { DicomSeriesRail } from './viewer-series-rail'
import { DicomSliceSlider } from './viewer-slice-slider'
import { ViewerAdvancedTools } from './viewer-advanced-tools'
import { DicomViewerToolbar, type DicomViewerToolbarProps } from './viewer-toolbar'

const series: ImagingSeries[] = [
  {
    id: 'a',
    label: 'IRM SAG T2',
    urls: ['u1'],
    fileCount: 24,
    modality: 'MR',
    description: 'SAG T2',
  },
  {
    id: 'b',
    label: 'IRM AX T1',
    urls: ['u2'],
    fileCount: 30,
    modality: 'MR',
    description: 'AX T1',
  },
  { id: 'c', label: 'Scanner', urls: ['u3'], fileCount: 1, modality: 'CT' },
]

describe('DicomSeriesRail (U0)', () => {
  it('liste les séries avec badge modality, compteur et série active', () => {
    const html = renderToStaticMarkup(
      <DicomSeriesRail variant="rail" series={series} activeIndex={1} onSelect={() => undefined} />
    )
    expect(html).toContain('data-testid="dicom-series-rail"')
    expect((html.match(/data-testid="dicom-series-rail-item"/g) ?? []).length).toBe(3)
    expect(html).toContain('IRM SAG T2')
    expect(html).toContain('>MR<')
    expect(html).toContain('>CT<')
    expect(html).toContain('24 fichiers')
    expect(html).toContain('1 fichier<')
    expect(html).toContain('aria-current="true"')
    expect(html).toContain('Séries (3)')
  })

  it('ne rend rien pour une étude mono-série', () => {
    const html = renderToStaticMarkup(
      <DicomSeriesRail
        variant="rail"
        series={series.slice(0, 1)}
        activeIndex={0}
        onSelect={() => undefined}
      />
    )
    expect(html).toBe('')
  })

  it('variante sheet mobile avec fermeture', () => {
    const html = renderToStaticMarkup(
      <DicomSeriesRail
        variant="sheet"
        series={series}
        activeIndex={0}
        onSelect={() => undefined}
        onClose={() => undefined}
      />
    )
    expect(html).toContain('data-testid="dicom-series-sheet"')
    expect(html).toContain('role="dialog"')
    expect(html).toContain('Fermer la liste des séries')
  })
})

describe('DicomCornerOverlay (U0)', () => {
  it('affiche modality/description, coupe n/N et W/L sans PHI', () => {
    const html = renderToStaticMarkup(
      <DicomCornerOverlay
        modality="MR"
        description="SAG T2"
        sliceIndex={4}
        sliceTotal={24}
        windowLevel={{ center: 512, width: 1024 }}
        inverted
      />
    )
    expect(html).toContain('MR · SAG T2')
    expect(html).toContain('Coupe 5 / 24')
    expect(html).toContain('F 1024 / C 512')
    expect(html).toContain('Inversé')
    expect(html).toContain('pointer-events-none')
  })

  it('masque le compteur pour une image unique et le W/L absent', () => {
    const html = renderToStaticMarkup(
      <DicomCornerOverlay modality="DX" sliceIndex={0} sliceTotal={1} windowLevel={null} />
    )
    expect(html).not.toContain('Coupe 1 / 1')
    expect(html).not.toContain('dicom-overlay-wl')
    expect(html).toContain('>DX<')
  })

  it('libellé fichier en mode séquentiel', () => {
    const html = renderToStaticMarkup(
      <DicomCornerOverlay sliceIndex={1} sliceTotal={3} unit="fichier" />
    )
    expect(html).toContain('Fichier 2 / 3')
  })
})

describe('DicomSliceSlider (U0)', () => {
  it('rend un range borné avec aria-valuetext', () => {
    const html = renderToStaticMarkup(
      <DicomSliceSlider index={3} total={12} onChange={() => undefined} />
    )
    expect(html).toContain('type="range"')
    expect(html).toContain('max="11"')
    expect(html).toContain('value="3"')
    expect(html).toContain('Coupe 4 sur 12')
  })

  it('ne rend rien pour une image unique', () => {
    expect(
      renderToStaticMarkup(<DicomSliceSlider index={0} total={1} onChange={() => undefined} />)
    ).toBe('')
  })
})

function toolbarProps(overrides: Partial<DicomViewerToolbarProps> = {}): DicomViewerToolbarProps {
  return {
    tools: [
      { id: 'WindowLevel', label: 'Fenêtrage', shortLabel: 'Fenêt.', available: true },
      { id: 'ZoomAndPan', label: 'Zoom / Déplacement', shortLabel: 'Zoom', available: true },
      {
        id: 'Scroll',
        label: 'Coupes',
        shortLabel: 'Coupes',
        available: false,
        disabledTitle: 'Réservé à l’écran tactile',
      },
    ],
    tool: 'WindowLevel',
    isReady: true,
    activateTool: () => undefined,
    handleZoomStep: () => undefined,
    activePreset: null,
    applyWindowPreset: () => undefined,
    handleAutoWindow: () => undefined,
    handleReset: () => undefined,
    handleToggleInvert: () => undefined,
    handleFlipHorizontal: () => undefined,
    canNavigateSlices: true,
    navigateSlice: () => undefined,
    displaySliceIndex: 0,
    displayTotal: 10,
    navMode: 'stack',
    showHeader: true,
    infoKind: 'stack',
    sliceCount: 10,
    fileCount: 10,
    errorMessage: null,
    preloadLoaded: 0,
    preloadMode: false,
    hint: '',
    mobileHint: '',
    ...overrides,
  }
}

describe('DicomViewerToolbar (U0)', () => {
  it('IRM : Auto + Inverser, aucun preset HU', () => {
    const html = renderToStaticMarkup(<DicomViewerToolbar {...toolbarProps({ presets: [] })} />)
    expect(html).toContain('data-testid="dicom-wl-auto"')
    expect(html).toContain('data-testid="dicom-invert"')
    expect(html).toContain('data-testid="dicom-flip-h"')
    expect(html).not.toContain('dicom-wl-preset-')
    expect(html).toContain('>Coupes<')
    expect(html).toContain('Réservé à l’écran tactile')
  })

  it('CT : presets HU visibles', () => {
    const html = renderToStaticMarkup(
      <DicomViewerToolbar {...toolbarProps({ presets: WL_PRESETS, activePreset: 'bone' })} />
    )
    expect(html).toContain('data-testid="dicom-wl-preset-soft"')
    expect(html).toContain('data-testid="dicom-wl-preset-bone"')
    expect(html).toContain('data-testid="dicom-wl-preset-brain"')
  })

  it('bouton Séries mobile quand le rail est disponible', () => {
    const html = renderToStaticMarkup(
      <DicomViewerToolbar
        {...toolbarProps({ seriesCount: 3, onOpenSeriesSheet: () => undefined })}
      />
    )
    expect(html).toContain('data-testid="dicom-series-sheet-open"')
    expect(html).toContain('md:hidden')
  })
})

describe('ViewerAdvancedTools', () => {
  it('garde Distance, Angle, Cobb, Ciné, Comparer et MPR visibles mais grisés', () => {
    const html = renderToStaticMarkup(
      <ViewerAdvancedTools
        measureEnabled={false}
        measureKind={null}
        measureTitle={() => 'Indisponible sur les images JPEG 2000'}
        cineEnabled={false}
        cineTitle="Il faut au moins deux coupes"
        compareEnabled={false}
        compareTitle="Il faut au moins deux séries"
        mprEnabled={false}
        mprTitle="Les trois vues sont indisponibles"
      />
    )
    for (const id of [
      'dicom-tool-length',
      'dicom-tool-angle',
      'dicom-tool-cobb',
      'dicom-cine',
      'dicom-compare',
      'dicom-mpr-toggle',
    ]) {
      expect(html).toContain(`data-testid="${id}"`)
    }
    expect(html).toContain('disabled')
    expect(html).toContain('Indisponible sur les images JPEG 2000')
    expect(html).toContain('Il faut au moins deux coupes')
    expect(html).toContain('Les trois vues sont indisponibles')
  })
})
