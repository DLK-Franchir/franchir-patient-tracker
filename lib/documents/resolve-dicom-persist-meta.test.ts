import { describe, expect, it } from 'vitest'
import { resolveDicomPersistMeta } from '@/lib/documents/resolve-dicom-persist-meta'
import { seriesUidFilenamePrefix } from '@/lib/imaging/dicom-series-uid-name'

describe('resolveDicomPersistMeta', () => {
  it('priorise le payload client', () => {
    const meta = resolveDicomPersistMeta('slice.dcm', {
      sopInstanceUid: 'sop-1',
      seriesInstanceUid: 'series-client',
      seriesDescription: 'AX T1',
      bodyPart: 'SPINE',
      instanceNumber: 3,
      acquisitionDatetime: '20240101120000',
    })
    expect(meta).toEqual({
      sopInstanceUid: 'sop-1',
      seriesInstanceUid: 'series-client',
      seriesDescription: 'AX T1',
      bodyPart: 'SPINE',
      instanceNumber: 3,
      acquisitionDatetime: '20240101120000',
    })
  })

  it('retombe sur SUID encode dans le nom si payload incomplet', () => {
    const uid = '1.2.840.113619.2.55.3.series'
    const name = `${seriesUidFilenamePrefix(uid)}.IM000001.dcm`
    const meta = resolveDicomPersistMeta(name, {
      sopInstanceUid: 'sop-x',
      seriesInstanceUid: null,
    })
    expect(meta?.seriesInstanceUid).toBe(uid)
    expect(meta?.sopInstanceUid).toBe('sop-x')
  })

  it('retire le prefixe timestamp Storage avant decode SUID', () => {
    const uid = '1.2.3.4'
    const name = `1710000000000_${seriesUidFilenamePrefix(uid)}.cut.dcm`
    const meta = resolveDicomPersistMeta(name, null)
    expect(meta?.seriesInstanceUid).toBe(uid)
  })

  it('renvoie null sans aucune meta', () => {
    expect(resolveDicomPersistMeta('report.pdf', null)).toBeNull()
  })
})
