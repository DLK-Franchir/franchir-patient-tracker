import { describe, expect, it } from 'vitest'
import {
  FORWARD_TO_QUESTIONNAIRES_MAX_BYTES,
  UPLOAD_LIMITS_MB,
  uploadGuidanceLines,
} from './upload-guidance'
import { MAX_DOCUMENT_FILE_SIZE, MAX_DOCUMENTS_PER_REQUEST } from './patient-documents'

describe('upload-guidance', () => {
  it('reflects patient-documents constants', () => {
    expect(UPLOAD_LIMITS_MB.maxFileSize).toBe(Math.round(MAX_DOCUMENT_FILE_SIZE / (1024 * 1024)))
    expect(UPLOAD_LIMITS_MB.maxFilesPerBatch).toBe(MAX_DOCUMENTS_PER_REQUEST)
    expect(UPLOAD_LIMITS_MB.forwardMaxFileSize).toBe(
      Math.round(FORWARD_TO_QUESTIONNAIRES_MAX_BYTES / (1024 * 1024)),
    )
  })

  it('exposes five guidance lines for the info banner', () => {
    expect(uploadGuidanceLines()).toHaveLength(5)
  })

  it('includes numeric limits in French copy', () => {
    const lines = uploadGuidanceLines().join(' ')
    expect(lines).toContain('100 Mo')
    expect(lines).toContain('50 Mo')
    expect(lines).toContain('1000 fichiers')
    expect(lines).toContain('50 coupes')
    expect(lines).toContain('4 en parallèle')
  })
})
