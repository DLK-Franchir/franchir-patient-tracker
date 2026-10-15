import { describe, expect, it } from 'vitest'
import { imagingThumbnailBadge } from './imaging-thumbnail-badge'

describe('imagingThumbnailBadge', () => {
  it('marque un EOS FullBody', () => {
    expect(
      imagingThumbnailBadge({
        kind: 'dicom',
        modality: 'DX',
        seriesDescription: 'FullBody',
      }),
    ).toEqual({ label: 'EOS', tone: 'eos' })
  })

  it('marque une ordonnance numérisée à part de la radio', () => {
    expect(
      imagingThumbnailBadge({
        kind: 'dicom',
        modality: 'CR',
        seriesDescription: 'ORDONNANCE',
      }),
    ).toEqual({ label: 'Ordonnance', tone: 'pdf' })
  })

  it('distingue scanner, infiltration et séquences IRM', () => {
    expect(
      imagingThumbnailBadge({ kind: 'dicom', modality: 'CT', seriesDescription: 'RACHIS LOMBAIRE' }),
    ).toEqual({ label: 'SCANNER', tone: 'scanner' })
    expect(
      imagingThumbnailBadge({ kind: 'dicom', modality: 'CT', seriesDescription: 'INFILTRATION L4-L5' }),
    ).toEqual({ label: 'SCANNER INFILT.', tone: 'infilt' })
    expect(
      imagingThumbnailBadge({ kind: 'dicom', modality: 'MR', seriesDescription: 'SAG T2' }),
    ).toEqual({ label: 'IRM T2', tone: 'irm-t2' })
    expect(
      imagingThumbnailBadge({ kind: 'dicom', modality: 'MR', seriesDescription: 'SAG T1' }),
    ).toEqual({ label: 'IRM T1', tone: 'irm-t1' })
    expect(
      imagingThumbnailBadge({ kind: 'dicom', modality: 'MR', seriesDescription: 'SURVEY 5 COUPES' }),
    ).toEqual({ label: 'IRM', tone: 'irm' })
  })

  it('laisse une radio classique en RADIO', () => {
    expect(
      imagingThumbnailBadge({
        kind: 'dicom',
        modality: 'DX',
        seriesDescription: 'COL.LOMBAIRE AP MURAL',
      }),
    ).toEqual({ label: 'RADIO', tone: 'radio' })
  })

  it('pastille PDF et vidéo, pas de pastille sur une photo', () => {
    expect(imagingThumbnailBadge({ kind: 'pdf', fileName: 'compte-rendu.pdf' })).toEqual({
      label: 'PDF',
      tone: 'pdf',
    })
    expect(imagingThumbnailBadge({ kind: 'video' })).toEqual({ label: 'MP4', tone: 'video' })
    expect(imagingThumbnailBadge({ kind: 'image', fileName: 'photo.jpg' })).toBeNull()
  })
})
