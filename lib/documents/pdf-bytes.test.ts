import { describe, expect, it } from 'vitest'
import { findPdfSlice } from './pdf-bytes'

describe('findPdfSlice', () => {
  it('isole le PDF même s’il est précédé d’un en-tête DICOM', () => {
    const pdf = new TextEncoder().encode('%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF')
    const wrapped = new Uint8Array(pdf.length + 8)
    wrapped.set([0, 1, 2, 3, 4, 5, 6, 7], 0)
    wrapped.set(pdf, 8)
    const slice = findPdfSlice(wrapped)
    expect(slice).not.toBeNull()
    expect(new TextDecoder().decode(slice!)).toMatch(/^%PDF-1\.4/)
    expect(new TextDecoder().decode(slice!)).toMatch(/%%EOF$/)
  })

  it('retourne null sans en-tête PDF', () => {
    expect(findPdfSlice(new Uint8Array([1, 2, 3, 4]))).toBeNull()
  })
})
