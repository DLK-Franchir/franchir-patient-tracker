import { AlertTriangle, Info, Activity } from 'lucide-react'
import type { ViewerInfoKind } from './dicom-viewer-types'

export function ViewerInfoBubble({
  kind,
  sliceCount,
  fileCount,
  errorMessage,
  infoNote,
  preloadLoaded,
  preloadTotal,
  preloadMode,
}: {
  kind: ViewerInfoKind;
  sliceCount: number;
  fileCount: number;
  errorMessage?: string | null;
  infoNote?: string | null;
  preloadLoaded?: number;
  preloadTotal?: number;
  preloadMode?: boolean;
}) {
  if (kind === 'loading') {
    const label =
      preloadMode && preloadTotal && preloadTotal > 1 && typeof preloadLoaded === 'number'
        ? `Préchargement des images (${preloadLoaded}/${preloadTotal})…`
        : fileCount > 1
          ? `Chargement de la série (${fileCount} fichiers)…`
          : 'Chargement de l\'image…'
    return (
      <span
        className="inline-flex max-w-sm items-center gap-2 rounded-lg border border-amber-400/35 bg-amber-950/80 px-3 py-1.5 text-xs font-medium text-amber-50 shadow-sm"
        data-testid="dicom-info-bubble"
      >
        <span
          className="inline-block size-3 shrink-0 rounded-full border-2 border-amber-200/30 border-t-amber-100 animate-spin"
          aria-hidden
        />
        {label}
      </span>
    )
  }

  if (kind === 'error') {
    return (
      <span
        className="inline-flex max-w-md items-start gap-2 rounded-full border border-red-400/30 bg-red-500/10 px-3 py-1 text-[11px] text-red-100"
        data-testid="dicom-info-bubble"
      >
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        <span>
          Affichage impossible
          {errorMessage ? ` — ${errorMessage}` : ' — format non pris en charge, fichier corrompu ou lien expiré'}
        </span>
      </span>
    )
  }

  if (kind === 'partial') {
    return (
      <span
        className="inline-flex max-w-md items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-950/70 px-3 py-1.5 text-xs font-medium text-amber-50 shadow-sm"
        data-testid="dicom-info-bubble"
      >
        <Info className="size-3.5 shrink-0 text-amber-300" strokeWidth={1.75} aria-hidden="true" />
        Série de {fileCount} fichiers — {sliceCount} coupe{sliceCount > 1 ? 's navigables' : ' navigable'}
      </span>
    )
  }

  if (kind === 'sequential') {
    return (
      <span
        className="inline-flex max-w-md items-center gap-2 rounded-lg border border-sky-400/40 bg-sky-950/70 px-3 py-1.5 text-xs font-medium text-sky-50 shadow-sm"
        data-testid="dicom-info-bubble"
      >
        <Info className="size-3.5 shrink-0 text-sky-300" strokeWidth={1.75} aria-hidden="true" />
        <span>
          Série de {fileCount} fichiers — navigation fichier par fichier (← →)
          {infoNote ? ` — ${infoNote}` : ''}
        </span>
      </span>
    )
  }

  if (kind === 'single') {
    return (
      <span
        className="inline-flex max-w-xs items-center gap-2 rounded-lg border border-white/20 bg-slate-900/90 px-3 py-1.5 text-xs font-medium text-white/90 shadow-sm"
        data-testid="dicom-info-bubble"
      >
        <Info className="size-3.5 shrink-0 text-[#38B2AC]" strokeWidth={1.75} aria-hidden="true" />
        Image unique — pas de navigation entre coupes
      </span>
    )
  }

  return (
    <span
      className="inline-flex max-w-sm items-center gap-2 rounded-lg border border-[#38B2AC]/50 bg-[#38B2AC]/25 px-3 py-1.5 text-xs font-medium text-white shadow-sm"
      data-testid="dicom-info-bubble"
    >
      <Activity className="size-3.5 shrink-0 text-[#38B2AC]" strokeWidth={1.75} aria-hidden="true" />
      Suite de {sliceCount} image{sliceCount > 1 ? 's' : ''} — ← → ou outil Coupes
    </span>
  )
}
