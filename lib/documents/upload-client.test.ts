import { describe, expect, it } from 'vitest'
import { selectFilesForPatientUpload } from '@/lib/documents/upload-client'

function file(name: string, type: string): File {
  return new File(['x'], name, { type })
}

describe('selectFilesForPatientUpload', () => {
  it('envoie un lot mixte volontaire (quelques PDF + DICOM)', () => {
    const files = [
      file('coupe.dcm', 'application/dicom'),
      file('ordo.pdf', 'application/pdf'),
      file('photo.jpg', 'image/jpeg'),
    ]
    expect(selectFilesForPatientUpload(files)).toHaveLength(3)
  })

  it('ignore les aperçus JPEG d un CD quand il y a déjà des coupes DICOM', () => {
    const dicom = Array.from({ length: 5 }, (_, i) =>
      file(`SE0001_IM${String(i).padStart(4, '0')}.dcm`, 'application/dicom'),
    )
    const jpegs = Array.from({ length: 20 }, (_, i) => file(`thumb-${i}.jpg`, 'image/jpeg'))
    const selected = selectFilesForPatientUpload([...dicom, ...jpegs])
    expect(selected).toHaveLength(5)
    expect(selected.every((item) => item.name.endsWith('.dcm'))).toBe(true)
  })
})
