import { describe, expect, it } from 'vitest'
import {
  seriesDownloadProgressMessage,
  studyAsyncExpiredMessage,
  studyChunkedSuccessMessage,
  studyDownloadProgressMessage,
  studyTooLargeFallbackMessage,
} from './export-messages'

describe('export-messages', () => {
  it('annonce la préparation multi-lots', () => {
    expect(
      studyDownloadProgressMessage({ completed: 0, total: 3, mode: 'chunked' }),
    ).toMatch(/3 fichiers ZIP/)
  })

  it('compte les lots en cours', () => {
    expect(
      studyDownloadProgressMessage({ completed: 2, total: 5, mode: 'chunked' }),
    ).toBe("Téléchargement de l'étude — lot 2/5…")
    expect(
      studyDownloadProgressMessage({ completed: 1, total: 4, mode: 'async' }),
    ).toMatch(/lot 1\/4/)
    expect(
      studyDownloadProgressMessage({ completed: 0, total: 4, mode: 'async' }),
    ).toMatch(/durable/)
  })

  it('reste simple pour un ZIP unique', () => {
    expect(
      studyDownloadProgressMessage({ completed: 0, total: 1, mode: 'single' }),
    ).toMatch(/Préparation/)
    expect(seriesDownloadProgressMessage()).toMatch(/série/)
  })

  it('explique le succès multi-ZIP pour Horos / RadiAnt', () => {
    const msg = studyChunkedSuccessMessage(4)
    expect(msg).toMatch(/4 archives ZIP/)
    expect(msg).toMatch(/Horos/)
    expect(studyChunkedSuccessMessage(1)).toMatch(/terminé/)
  })

  it('fournit un fallback study_too_large', () => {
    expect(studyTooLargeFallbackMessage()).toMatch(/lots/)
  })

  it('explique un job async expire', () => {
    expect(studyAsyncExpiredMessage()).toMatch(/expiré/)
    expect(studyAsyncExpiredMessage()).toMatch(/2 h/)
  })
})
