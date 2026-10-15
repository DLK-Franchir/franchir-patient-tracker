/**
 * Carte de la grille imagerie.
 * Titre, détail et vignette viennent des métadonnées DICOM.
 * Le nom de fichier ne sort jamais ici : il reste dans la visionneuse ouverte.
 */

import {
  imagingThumbnailBadge,
  type ImagingThumbnailBadge,
} from '@/lib/imaging/imaging-thumbnail-badge'

export type ImagingCardCategory = 'imagerie' | 'document'
export type ImagingPreview = 'full-rachis' | 'lombaires' | 'cervicales' | 'document'

export type ImagingCardPresentation = {
  category: ImagingCardCategory
  badge: ImagingThumbnailBadge
  title: string
  detail: string
  preview: ImagingPreview
}

export type ImagingCardSource = {
  categoryHint: 'dicom' | 'dicom-pdf' | 'pdf' | 'video' | 'image' | 'other'
  modality?: string | null
  seriesDescription?: string | null
  bodyPart?: string | null
  /** Classement uniquement (parcours, compte rendu). Jamais rendu. */
  classifyHint?: string | null
}

type Region = 'full' | 'lombaire' | 'cervical' | 'dorsal' | 'unknown'

function fold(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function regionOf(text: string, body: string): Region {
  const blob = `${text} ${body}`
  if (/cervic|cspine|\bneck\b/.test(blob)) return 'cervical'
  if (/lombaire|lspine|lumbar/.test(blob)) return 'lombaire'
  if (/dorsale|tspine|thorac|dorsal/.test(blob)) return 'dorsal'
  if (/full\s*body|\beos\b|rachis complet/.test(blob)) return 'full'
  if (/\bpelvis\b/.test(body)) return 'lombaire'
  if (/\bchest\b/.test(body)) return 'dorsal'
  return 'unknown'
}

function previewFor(region: Region, fallback: ImagingPreview): ImagingPreview {
  if (region === 'cervical') return 'cervicales'
  if (region === 'lombaire') return 'lombaires'
  if (region === 'full' || region === 'dorsal') return 'full-rachis'
  return fallback
}

function viewDetail(text: string): string | null {
  if (/survey|reperage|mobiview/.test(text)) return 'Repérage'
  if (/\b(sag|sagittal)\b/.test(text)) {
    return /spair/.test(text) ? 'Coupe sagittale · SPAIR' : 'Coupe sagittale'
  }
  if (/\b(ax|axial)\b/.test(text)) return 'Coupe axiale'
  if (/\b(cor|coronal)\b/.test(text)) return 'Coupe coronale'
  if (/\blat\b|profil/.test(text)) return 'Profil'
  if (/\bap\b|\bface\b/.test(text)) return 'Face'
  return null
}

function documentCard(title: string, detail: string): ImagingCardPresentation {
  return {
    category: 'document',
    badge: { label: 'PDF', tone: 'pdf' },
    title,
    detail,
    preview: 'document',
  }
}

function documentFromText(blob: string): ImagingCardPresentation | null {
  if (/ordonnance|prescription/.test(blob)) {
    return documentCard('Ordonnance', 'Prescription médicale')
  }
  if (/requete/.test(blob)) {
    return documentCard('Demande d’examen', 'Document numérisé')
  }
  if (/compte[\s-]?rendu|\brapport\b|report pdf/.test(blob)) {
    return documentCard('Compte rendu', 'Compte rendu radiologique')
  }
  if (/parcours/.test(blob)) {
    return documentCard('Parcours médical', 'Synthèse du dossier')
  }
  return null
}

export function presentImagingCard(source: ImagingCardSource): ImagingCardPresentation {
  const text = fold(source.seriesDescription)
  const body = fold(source.bodyPart)
  const hint = fold(source.classifyHint)
  const blob = `${text} ${hint}`
  const region = regionOf(text, body)
  const modality = (source.modality ?? '').trim().toUpperCase()

  if (source.categoryHint === 'video') {
    return {
      category: 'imagerie',
      badge: { label: 'MP4', tone: 'video' },
      title: 'Vidéo',
      detail: 'Séquence filmée',
      preview: previewFor(region, 'full-rachis'),
    }
  }

  if (
    source.categoryHint === 'pdf' ||
    source.categoryHint === 'dicom-pdf' ||
    source.categoryHint === 'image' ||
    source.categoryHint === 'other' ||
    modality === 'DOC'
  ) {
    return documentFromText(blob) ?? documentCard('Document', 'Document associé')
  }

  const namedDocument = documentFromText(blob)
  if (namedDocument) return namedDocument

  if (/infilt/.test(text)) {
    const level = text.match(/\b[ctl]\s*\d{1,2}\s*[-–]\s*[ctl]?\s*\d{1,2}\b/)
    const levelLabel = level ? level[0].toUpperCase().replace(/\s+/g, '').replace('-', '–') : null
    return {
      category: 'imagerie',
      badge: { label: 'SCANNER INFILT.', tone: 'infilt' },
      title: levelLabel ? `Infiltration ${levelLabel}` : 'Infiltration',
      detail: 'Guidage scanner',
      preview: previewFor(region, 'lombaires'),
    }
  }

  if (/\beos\b/.test(text) || /full\s*body/.test(text)) {
    const view = viewDetail(text)
    return {
      category: 'imagerie',
      badge: { label: 'EOS', tone: 'eos' },
      title: 'Radiographie du rachis',
      detail: view ? `Rachis complet · ${view}` : 'Rachis complet',
      preview: 'full-rachis',
    }
  }

  if (modality === 'MR') {
    const badge = imagingThumbnailBadge({
      kind: 'dicom',
      modality,
      seriesDescription: source.seriesDescription,
    }) ?? { label: 'IRM', tone: 'irm' as const }
    const title =
      region === 'cervical'
        ? 'Imagerie cervicale'
        : region === 'lombaire'
          ? 'IRM lombaire'
          : region === 'dorsal'
            ? 'IRM dorsale'
            : 'IRM'
    const view = viewDetail(text)
    const detail =
      region === 'cervical' && view === 'Profil'
        ? 'Rachis cervical · Profil'
        : region === 'cervical' && !view
          ? 'Rachis cervical'
          : view ?? 'Séquence IRM'
    return {
      category: 'imagerie',
      badge,
      title,
      detail,
      preview: previewFor(region, 'lombaires'),
    }
  }

  if (modality === 'CT') {
    const title =
      region === 'cervical'
        ? 'Scanner cervical'
        : region === 'dorsal'
          ? 'Scanner dorsal'
          : region === 'full'
            ? 'Scanner du rachis'
            : 'Scanner lombaire'
    return {
      category: 'imagerie',
      badge: { label: 'SCANNER', tone: 'scanner' },
      title,
      detail: viewDetail(text) ?? 'Examen scanner',
      preview: previewFor(region, 'lombaires'),
    }
  }

  if (modality === 'DX' || modality === 'CR' || modality === 'RG') {
    const title =
      region === 'cervical'
        ? 'Radiographie cervicale'
        : region === 'lombaire'
          ? 'Radiographie lombaire'
          : region === 'dorsal'
            ? 'Radiographie dorsale'
            : 'Radiographie'
    return {
      category: 'imagerie',
      badge: { label: 'RADIO', tone: 'radio' },
      title,
      detail: viewDetail(text) ?? 'Cliché',
      preview: previewFor(region, 'full-rachis'),
    }
  }

  if (modality === 'US') {
    return {
      category: 'imagerie',
      badge: { label: 'ÉCHO', tone: 'echo' },
      title: 'Échographie',
      detail: viewDetail(text) ?? 'Examen',
      preview: previewFor(region, 'lombaires'),
    }
  }

  const fallback = imagingThumbnailBadge({
    kind: 'dicom',
    modality,
    seriesDescription: source.seriesDescription,
  })
  return {
    category: 'imagerie',
    badge: fallback ?? { label: 'DICOM', tone: 'other' },
    title: fallback?.label ?? 'Imagerie',
    detail: viewDetail(text) ?? 'Examen',
    preview: previewFor(region, 'full-rachis'),
  }
}
