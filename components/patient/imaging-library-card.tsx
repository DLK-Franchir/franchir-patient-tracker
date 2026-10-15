'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { ImagingBadgeTone } from '@/lib/imaging/imaging-thumbnail-badge'
import type { ImagingCardPresentation, ImagingPreview } from '@/lib/imaging/imaging-card-presentation'
import styles from './imaging-library.module.css'

const PREVIEW_SRC: Record<Exclude<ImagingPreview, 'document'>, string> = {
  'full-rachis': '/imaging/previews/full-rachis.jpg',
  lombaires: '/imaging/previews/lombaires.jpg',
  cervicales: '/imaging/previews/cervicales.jpg',
}

const TONE_CLASS: Record<ImagingBadgeTone, string> = {
  eos: '',
  scanner: styles.toneScanner,
  infilt: styles.toneInfilt,
  'irm-t2': styles.toneIrmT2,
  'irm-t1': styles.toneIrmT1,
  irm: styles.toneIrm,
  radio: styles.toneRadio,
  pdf: styles.tonePdf,
  video: styles.toneVideo,
  echo: styles.toneEcho,
  angio: styles.toneAngio,
  other: styles.toneOther,
}

const PREVIEW_CLASS: Record<ImagingPreview, string> = {
  'full-rachis': styles.previewFull,
  lombaires: styles.previewLombaires,
  cervicales: styles.previewCervicales,
  document: styles.previewDocument,
}

function Icon({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <svg aria-hidden="true" fill="none" height={size} viewBox="0 0 24 24" width={size}>
      {children}
    </svg>
  )
}

function DownloadIcon() {
  return (
    <Icon size={18}>
      <path d="M12 4v11m0 0l-4-4m4 4l4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M5 19h14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
    </Icon>
  )
}

function FileIcon() {
  return (
    <Icon size={15}>
      <path d="M7 3h6l4 4v14H7V3z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
      <path d="M13 3v5h4M9.5 12.5h5M9.5 16h5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
    </Icon>
  )
}

function ImageIcon() {
  return (
    <Icon size={15}>
      <rect height="16" rx="2" stroke="currentColor" strokeWidth="1.7" width="18" x="3" y="4" />
      <circle cx="8.5" cy="9" r="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 17l4.5-4 3 2.5 2.5-2 6 5" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
    </Icon>
  )
}

function MoreIcon() {
  return (
    <Icon>
      <circle cx="5" cy="12" fill="currentColor" r="1.6" />
      <circle cx="12" cy="12" fill="currentColor" r="1.6" />
      <circle cx="19" cy="12" fill="currentColor" r="1.6" />
    </Icon>
  )
}

function DocumentVisual() {
  return (
    <div className={styles.documentVisual} aria-hidden="true">
      <div className={styles.documentSheet}>
        <div className={styles.pdfLabel}>PDF</div>
        <span />
        <span />
        <span className={styles.shortLine} />
        <span />
        <span className={styles.shortLine} />
      </div>
    </div>
  )
}

export function ImagingLibraryCard({
  presentation,
  dateLabel,
  canDownload,
  canDelete,
  downloadBusy,
  deleteBusy,
  onOpen,
  onDownload,
  onDelete,
}: {
  presentation: ImagingCardPresentation
  dateLabel: string
  canDownload: boolean
  canDelete: boolean
  downloadBusy: boolean
  deleteBusy: boolean
  onOpen: () => void
  onDownload: () => void
  onDelete: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const { title, detail, badge, preview, category } = presentation

  useEffect(() => {
    if (!menuOpen) return
    const onDoc = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  return (
    <article className={styles.fileCard}>
      <button className={styles.cardHitarea} type="button" aria-label={`Ouvrir ${title}`} onClick={onOpen} />
      <div className={`${styles.preview} ${PREVIEW_CLASS[preview]}`}>
        <span className={`${styles.modality} ${TONE_CLASS[badge.tone]}`}>{badge.label}</span>
        {canDelete ? (
          <div ref={menuRef}>
            <button
              className={styles.moreButton}
              type="button"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              aria-label={`Plus d’options pour ${title}`}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <MoreIcon />
            </button>
            {menuOpen ? (
              <div className={styles.moreMenu} id={menuId} role="menu">
                <button
                  type="button"
                  role="menuitem"
                  disabled={deleteBusy}
                  onClick={() => {
                    setMenuOpen(false)
                    onDelete()
                  }}
                >
                  Supprimer
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        {preview === 'document' ? (
          <DocumentVisual />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" className={styles.medicalImage} src={PREVIEW_SRC[preview]} />
        )}
        <span className={styles.fileKind}>
          {category === 'imagerie' ? <ImageIcon /> : <FileIcon />}
          {category === 'imagerie' ? 'Image médicale' : 'Document'}
        </span>
      </div>
      <div className={styles.cardContent}>
        <div className={styles.cardCopy}>
          <div className={styles.cardTitleRow}>
            <h3>{title}</h3>
            {canDownload ? (
              <button
                className={styles.downloadButton}
                type="button"
                disabled={downloadBusy}
                aria-label={downloadBusy ? `Téléchargement de ${title}` : `Télécharger ${title}`}
                onClick={onDownload}
              >
                <DownloadIcon />
              </button>
            ) : null}
          </div>
          <p>{detail}</p>
        </div>
        <div className={styles.cardDate}>
          <span>Date de l’examen</span>
          <time>{dateLabel}</time>
        </div>
      </div>
    </article>
  )
}

export function ImagingLibraryChrome({
  children,
}: {
  children: ReactNode
}) {
  return <div className={styles.library}>{children}</div>
}

export { styles as imagingLibraryStyles }
