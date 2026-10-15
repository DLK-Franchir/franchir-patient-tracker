import { describe, expect, it } from 'vitest'
import { presentImagingCard } from './imaging-card-presentation'

describe('presentImagingCard', () => {
  it('présente un EOS FullBody comme la maquette, sans le nom de fichier', () => {
    const card = presentImagingCard({
      categoryHint: 'dicom',
      modality: 'DX',
      seriesDescription: 'FullBody',
      bodyPart: 'AB',
      classifyHint: 'SUID.EE919111.dcm',
    })
    expect(card).toMatchObject({
      category: 'imagerie',
      title: 'Radiographie du rachis',
      detail: 'Rachis complet',
      preview: 'full-rachis',
      badge: { label: 'EOS', tone: 'eos' },
    })
    expect(JSON.stringify(card)).not.toContain('EE919111')
  })

  it('classe ordonnance, demande et compte rendu comme documents', () => {
    expect(
      presentImagingCard({
        categoryHint: 'dicom',
        modality: 'CR',
        seriesDescription: 'ORDONNANCE',
      }),
    ).toMatchObject({
      category: 'document',
      title: 'Ordonnance',
      detail: 'Prescription médicale',
      preview: 'document',
      badge: { label: 'PDF', tone: 'pdf' },
    })
    expect(
      presentImagingCard({
        categoryHint: 'dicom',
        modality: 'DX',
        seriesDescription: 'REQUêTE NUMéRISéE',
      }).title,
    ).toBe('Demande d’examen')
    expect(
      presentImagingCard({
        categoryHint: 'dicom-pdf',
        modality: 'DOC',
        seriesDescription: 'REPORT PDF',
      }),
    ).toMatchObject({ title: 'Compte rendu', preview: 'document' })
  })

  it('distingue radios lombaire et dorsale, et les séquences IRM', () => {
    expect(
      presentImagingCard({
        categoryHint: 'dicom',
        modality: 'DX',
        seriesDescription: 'COL.LOMBAIRE AP MURAL',
        bodyPart: 'PELVIS',
      }),
    ).toMatchObject({
      title: 'Radiographie lombaire',
      detail: 'Face',
      preview: 'lombaires',
      badge: { label: 'RADIO', tone: 'radio' },
    })
    expect(
      presentImagingCard({
        categoryHint: 'dicom',
        modality: 'DX',
        seriesDescription: 'COL DORSALE LAT',
        bodyPart: 'CHEST',
      }),
    ).toMatchObject({
      title: 'Radiographie dorsale',
      detail: 'Profil',
      preview: 'full-rachis',
    })
    expect(
      presentImagingCard({
        categoryHint: 'dicom',
        modality: 'MR',
        seriesDescription: 'SAG T2',
        bodyPart: 'LSPINE',
      }),
    ).toMatchObject({
      title: 'IRM lombaire',
      detail: 'Coupe sagittale',
      preview: 'lombaires',
      badge: { label: 'IRM T2', tone: 'irm-t2' },
    })
    expect(
      presentImagingCard({
        categoryHint: 'dicom',
        modality: 'MR',
        seriesDescription: 'T2 AX DRIVE',
        bodyPart: 'CSPINE',
      }),
    ).toMatchObject({
      title: 'Imagerie cervicale',
      detail: 'Coupe axiale',
      preview: 'cervicales',
    })
    expect(
      presentImagingCard({
        categoryHint: 'dicom',
        modality: 'MR',
        seriesDescription: 'SURVEY 5 COUPES',
        bodyPart: 'LSPINE',
      }).detail,
    ).toBe('Repérage')
  })

  it('nomme un PDF d’après son rôle, pas d’après le fichier', () => {
    const card = presentImagingCard({
      categoryHint: 'pdf',
      classifyHint: 'Parcours Médical Lefebvre Liette.pdf',
    })
    expect(card.title).toBe('Parcours médical')
    expect(JSON.stringify(card)).not.toContain('Lefebvre')
    expect(
      presentImagingCard({
        categoryHint: 'pdf',
        classifyHint: 'PATIENT_RESULTS_5b8021d7.pdf',
      }).title,
    ).toBe('Document')
  })

  it('reconnaît une infiltration scanner', () => {
    expect(
      presentImagingCard({
        categoryHint: 'dicom',
        modality: 'CT',
        seriesDescription: 'INFILTRATION L4-L5',
        bodyPart: 'LSPINE',
      }),
    ).toMatchObject({
      title: 'Infiltration L4–L5',
      detail: 'Guidage scanner',
      badge: { label: 'SCANNER INFILT.', tone: 'infilt' },
      preview: 'lombaires',
    })
  })
})
