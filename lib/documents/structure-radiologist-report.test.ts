import { describe, expect, it } from 'vitest'
import {
  ABSENT_SECTION_LABEL,
  reportExtractErrorMessage,
  reportHasExtractedContent,
  structureRadiologistReport,
} from './structure-radiologist-report'

describe('structureRadiologistReport', () => {
  it('découpe les sections FR classiques sans inventer de texte', () => {
    const text = `
INDICATION :
Rachialgie lombaire.

TECHNIQUE :
IRM 1,5 T, séquences sagittales T1 T2.

RÉSULTATS :
Discopathie L4-L5.

CONCLUSION :
Pas de conflit radiculaire franc.

AVIS :
Contrôle clinique.
`.trim()

    const sections = structureRadiologistReport(text)
    expect(sections.map(s => s.id)).toEqual([
      'indication',
      'technique',
      'resultats',
      'conclusion',
      'avis',
    ])
    expect(sections.find(s => s.id === 'indication')?.text).toMatch(/Rachialgie/)
    expect(sections.find(s => s.id === 'technique')?.text).toMatch(/IRM/)
    expect(sections.find(s => s.id === 'resultats')?.text).toMatch(/Discopathie/)
    expect(sections.find(s => s.id === 'conclusion')?.text).toMatch(/conflit/)
    expect(sections.find(s => s.id === 'avis')?.text).toMatch(/Contrôle/)
    expect(reportHasExtractedContent(sections)).toBe(true)
  })

  it('marque les sections absentes sans les compléter', () => {
    const sections = structureRadiologistReport('INDICATION : Douleur.\n\nCONCLUSION : RAS.')
    const technique = sections.find(s => s.id === 'technique')
    expect(technique?.present).toBe(false)
    expect(technique?.text).toBe(ABSENT_SECTION_LABEL)
    expect(sections.find(s => s.id === 'indication')?.present).toBe(true)
  })

  it('ne fabrique pas de diagnostic hors document', () => {
    const sections = structureRadiologistReport('')
    expect(sections.every(s => !s.present)).toBe(true)
    expect(sections.every(s => s.text === ABSENT_SECTION_LABEL)).toBe(true)
  })

  it('messages d’erreur utilisateurs sont actionnables', () => {
    expect(reportExtractErrorMessage('extract_failed')).toMatch(/PDF source/)
    expect(reportExtractErrorMessage('no_text_layer')).toMatch(/scann|OCR/i)
    expect(reportExtractErrorMessage('no_encapsulated_pdf')).toMatch(/DICOM/)
  })
})
