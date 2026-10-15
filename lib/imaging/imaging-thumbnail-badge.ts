/**
 * Pastille de type d'examen sur la vignette.
 * Le libellé de la carte reste celui de la série ; la pastille distingue EOS, scanner, IRM…
 */

export type ImagingBadgeTone =
  | 'eos'
  | 'scanner'
  | 'infilt'
  | 'irm-t2'
  | 'irm-t1'
  | 'irm'
  | 'radio'
  | 'pdf'
  | 'video'
  | 'echo'
  | 'angio'
  | 'other'

export type ImagingThumbnailBadge = {
  label: string
  tone: ImagingBadgeTone
}

export type ImagingBadgeKind = 'dicom' | 'pdf' | 'video' | 'image' | 'other'

function fold(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function imagingThumbnailBadge(input: {
  modality?: string | null
  seriesDescription?: string | null
  fileName?: string | null
  kind: ImagingBadgeKind
}): ImagingThumbnailBadge | null {
  if (input.kind === 'video') return { label: 'MP4', tone: 'video' }
  if (input.kind === 'pdf') return { label: 'PDF', tone: 'pdf' }
  if (input.kind === 'image' || input.kind === 'other') return null
  if (input.kind !== 'dicom') return null

  const modality = (input.modality ?? '').trim().toUpperCase()
  const text = [input.seriesDescription, input.fileName].map(fold).filter(Boolean).join(' ')

  if (modality === 'DOC' || /\b(report pdf|compte[\s-]?rendu)\b/.test(text)) {
    return { label: 'PDF', tone: 'pdf' }
  }
  if (/\b(ordonnance|prescription|requete)\b/.test(text)) {
    return { label: 'Ordonnance', tone: 'pdf' }
  }
  if (/infilt/.test(text)) {
    return { label: 'SCANNER INFILT.', tone: 'infilt' }
  }
  if ((modality === 'DX' || modality === 'CR' || modality === 'RG' || modality === '') &&
    (/\beos\b/.test(text) || /full\s*body/.test(text))) {
    return { label: 'EOS', tone: 'eos' }
  }
  if (modality === 'MR') {
    if (/\bt2\b/.test(text)) return { label: 'IRM T2', tone: 'irm-t2' }
    if (/\bt1\b/.test(text)) return { label: 'IRM T1', tone: 'irm-t1' }
    return { label: 'IRM', tone: 'irm' }
  }
  if (modality === 'CT') return { label: 'SCANNER', tone: 'scanner' }
  if (modality === 'DX' || modality === 'CR' || modality === 'RG') {
    return { label: 'RADIO', tone: 'radio' }
  }
  if (modality === 'US') return { label: 'ÉCHO', tone: 'echo' }
  if (modality === 'XA' || modality === 'RF') return { label: 'ANGIO', tone: 'angio' }
  if (modality === 'PT') return { label: 'TEP', tone: 'other' }
  if (modality === 'MG') return { label: 'MAMMO', tone: 'other' }
  if (modality === 'NM') return { label: 'SCINTI', tone: 'other' }
  if (modality) return { label: modality, tone: 'other' }
  return { label: 'DICOM', tone: 'other' }
}
