import type { ImagingBadgeTone, ImagingThumbnailBadge } from '@/lib/imaging/imaging-thumbnail-badge'

const TONE_CLASS: Record<ImagingBadgeTone, string> = {
  eos: 'border-[#22d3ee] bg-[#0891b2]',
  scanner: 'border-[#818cf8] bg-[#4f46e5]',
  infilt: 'border-[#fb923c] bg-[#ea580c]',
  'irm-t2': 'border-[#34d399] bg-[#059669]',
  'irm-t1': 'border-[#5eead4] bg-[#0f766e]',
  irm: 'border-[#6ee7b7] bg-[#047857]',
  radio: 'border-[#fbbf24] bg-[#b45309]',
  pdf: 'border-[#fb7185] bg-[#e11d48]',
  video: 'border-violet-300 bg-violet-600',
  echo: 'border-[#c4b5fd] bg-[#7c3aed]',
  angio: 'border-[#f9a8d4] bg-[#be185d]',
  other: 'border-[#94a3b8] bg-[#334155]',
}

export function ImagingTypeBadge({ badge }: { badge: ImagingThumbnailBadge }) {
  return (
    <span
      className={`absolute left-2 top-2 z-10 inline-flex max-w-[calc(100%-4.5rem)] items-center truncate rounded-md border px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white shadow-sm ${TONE_CLASS[badge.tone]}`}
    >
      {badge.label}
    </span>
  )
}
