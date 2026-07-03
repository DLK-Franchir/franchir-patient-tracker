'use client'

type NativeMp4ViewerProps = {
  src: string
  title: string
  className?: string
}

/**
 * Lecteur vidéo MP4 natif (HTML5). Pas de dépendance externe : le navigateur
 * décode H.264/AAC via `<video controls>`.
 */
export default function NativeMp4Viewer({ src, title, className }: NativeMp4ViewerProps) {
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
      <source src={src} type="video/mp4" />
      Votre navigateur ne prend pas en charge la lecture vidéo MP4.
    </video>
  )
}
