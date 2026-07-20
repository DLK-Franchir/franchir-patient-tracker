'use client'

import { mp4SourceMimeType } from '@/lib/features/mp4-viewer'

type NativeMp4ViewerProps = {
  src: string
  title: string
  className?: string
}

/**
 * Lecteur vidéo MP4/m4v natif (HTML5). Pas de dépendance externe : le navigateur
 * décode H.264/AAC via `<video controls>`.
 */
export default function NativeMp4Viewer({ src, title, className }: NativeMp4ViewerProps) {
  const sourceType = mp4SourceMimeType(src)
  return (
    <video
      key={src}
      controls
      playsInline
      preload="metadata"
      className={className ?? 'h-full w-full max-h-full max-w-full bg-black object-contain'}
      aria-label={title}
      data-testid="native-mp4-viewer"
    >
      <source src={src} type={sourceType} />
      Votre navigateur ne prend pas en charge la lecture vidéo MP4.
    </video>
  )
}
