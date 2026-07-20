import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ImagingCardActionMenu } from './imaging-card-action-menu'
import { ImagingDeleteConfirmDialog } from './imaging-delete-confirm-dialog'
import { ImagingDownloadScopeDialog } from './imaging-download-scope-dialog'
import { ImagingDownloadStatus } from './imaging-download-status'
import { ImagingGridEmptyState, ImagingGridLoadingState } from './imaging-grid-states'

describe('ImagingCardActionMenu', () => {
  it('rend telechargement et suppression quand autorises', () => {
    const html = renderToStaticMarkup(
      <ImagingCardActionMenu
        itemLabel="Serie A"
        canDownload
        canDelete
        onDownload={() => undefined}
        onDelete={() => undefined}
      />,
    )
    expect(html).toContain('imaging-card-action-menu')
    expect(html).toContain('Télécharger')
    expect(html).toContain('imaging-card-overflow')
  })

  it('masque le menu si aucune action', () => {
    const html = renderToStaticMarkup(
      <ImagingCardActionMenu itemLabel="Serie A" canDownload={false} canDelete={false} />,
    )
    expect(html).toBe('')
  })

  it('affiche le hint suppression reservee sans poubelle', () => {
    const html = renderToStaticMarkup(
      <ImagingCardActionMenu
        itemLabel="Serie A"
        canDownload
        canDelete={false}
        deleteReservedHint="Suppression réservée au tracker Marcel"
        onDownload={() => undefined}
      />,
    )
    expect(html).toContain('imaging-card-overflow')
    expect(html).toContain('imaging-card-delete-reserved')
    expect(html).toContain('Suppression réservée au tracker Marcel')
    expect(html).not.toContain('data-testid="imaging-card-delete"')
    expect(html).not.toContain('data-testid="imaging-card-delete-mobile"')
  })

  it('ignore le hint si canDelete est actif', () => {
    const html = renderToStaticMarkup(
      <ImagingCardActionMenu
        itemLabel="Serie A"
        canDownload={false}
        canDelete
        deleteReservedHint="Suppression réservée au tracker Marcel"
        onDelete={() => undefined}
      />,
    )
    expect(html).not.toContain('imaging-card-delete-reserved')
    expect(html).toContain('data-testid="imaging-card-delete"')
  })
})

describe('ImagingDownloadScopeDialog', () => {
  it('propose serie et etude', () => {
    const html = renderToStaticMarkup(
      <ImagingDownloadScopeDialog
        open
        itemLabel="Serie A"
        onSelect={() => undefined}
        onCancel={() => undefined}
      />,
    )
    expect(html).toContain('imaging-download-scope-dialog')
    expect(html).toContain('Cette série / séquence')
    expect(html).toContain('imaging-download-scope-study')
    expect(html).toMatch(/int[eé]gralit/i)
  })

  it('affiche busyMessage pendant export', () => {
    const html = renderToStaticMarkup(
      <ImagingDownloadScopeDialog
        open
        itemLabel="Serie A"
        busy
        busyMessage="Téléchargement de l'étude — lot 1/3…"
        onSelect={() => undefined}
        onCancel={() => undefined}
      />,
    )
    expect(html).toContain('imaging-download-scope-busy')
    expect(html).toContain('lot 1/3')
  })

  it('ne rend rien ferme', () => {
    const html = renderToStaticMarkup(
      <ImagingDownloadScopeDialog
        open={false}
        itemLabel="Serie A"
        onSelect={() => undefined}
        onCancel={() => undefined}
      />,
    )
    expect(html).toBe('')
  })
})

describe('ImagingGridEmptyState / Loading / DownloadStatus', () => {
  it('rend empty et loading grille', () => {
    expect(renderToStaticMarkup(<ImagingGridEmptyState />)).toContain('imaging-grid-empty')
    expect(renderToStaticMarkup(<ImagingGridLoadingState count={2} />)).toContain(
      'imaging-grid-loading',
    )
    expect(
      renderToStaticMarkup(
        <ImagingDownloadStatus
          open
          scope="study"
          progress={{ completed: 1, total: 3, mode: 'chunked' }}
        />,
      ),
    ).toContain('imaging-download-status')
  })
})

describe('ImagingDeleteConfirmDialog', () => {
  it('exige une confirmation explicite — pas de suppression one-click', () => {
    const onConfirm = vi.fn()
    const html = renderToStaticMarkup(
      <ImagingDeleteConfirmDialog
        open
        itemLabel="radio.jpg"
        onConfirm={onConfirm}
        onCancel={() => undefined}
      />,
    )
    expect(html).toContain('Supprimer définitivement ?')
    expect(html).toContain('imaging-delete-confirm-submit')
    expect(html).toContain('imaging-delete-confirm-cancel')
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('mode type SUPPRIMER pour series multi-fichiers', () => {
    const html = renderToStaticMarkup(
      <ImagingDeleteConfirmDialog
        open
        itemLabel="Serie DICOM"
        requireTypedConfirm
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    )
    expect(html).toContain('imaging-delete-confirm-input')
    expect(html).toContain('SUPPRIMER')
  })
})
