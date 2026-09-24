import { describe, expect, it } from 'vitest'
import { MAX_DOCUMENTS_LISTED } from '@/lib/documents/patient-documents'

describe('patient documents listing cap', () => {
  it('keeps a headroom above the previous 4000 cut that hid new IRM uploads', () => {
    expect(MAX_DOCUMENTS_LISTED).toBeGreaterThanOrEqual(6000)
  })
})
