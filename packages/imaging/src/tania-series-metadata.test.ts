import { describe, expect, it } from 'vitest'
import { groupDicomFilesByMetadata, type MetaImagingFile } from './dicom-series-group'

/**
 * Régression clinicien : sans SeriesInstanceUID, les noms 33230000_*.dcm
 * explosent en une carte par coupe (~195). Avec métadonnées tracker → ~11 séries.
 */
describe('groupDicomFilesByMetadata — étude type Tania (CD numérique)', () => {
  const SERIES = [
    { uid: 'suid-ax-t2-3', desc: 'AX T2 3 LEVELS', n: 21 },
    { uid: 'suid-ax-t2-2', desc: 'AX T2 2 LEVELS', n: 20 },
    { uid: 'suid-ax-t1-post', desc: 'AX T1 FS POST', n: 20 },
    { uid: 'suid-localizer', desc: 'localizer', n: 8 },
  ] as const

  function buildFiles(): MetaImagingFile[] {
    const files: MetaImagingFile[] = []
    let instance = 55616637
    for (const series of SERIES) {
      for (let i = 0; i < series.n; i += 1) {
        files.push({
          name: `33230000_${instance}.dcm`,
          url: `https://example/${instance}`,
          size: 2_000_000,
          seriesInstanceUid: series.uid,
          seriesDescription: series.desc,
          sopInstanceUid: `sop-${instance}`,
          instanceNumber: i + 1,
        })
        instance += 1
      }
    }
    return files
  }

  it('regroupe en N séries (pas N fichiers)', () => {
    const groups = groupDicomFilesByMetadata(buildFiles())
    expect(groups).toHaveLength(SERIES.length)
    expect(groups.map((g) => g.files.length).sort((a, b) => b - a)).toEqual(
      [...SERIES].map((s) => s.n).sort((a, b) => b - a),
    )
    expect(groups.some((g) => g.label.includes('AX T1 FS POST'))).toBe(true)
  })

  it('sans métadonnées : repli nom → explosion une carte / coupe', () => {
    const bare = buildFiles().map(({ name, url, size }) => ({ name, url, size }))
    const groups = groupDicomFilesByMetadata(bare)
    expect(groups.length).toBeGreaterThan(50)
  })
})
