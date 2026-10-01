import { describe, expect, it } from 'vitest'
import { structureRadiologistReport } from './structure-radiologist-report'
import {
  buildDeterministicSynthesis,
  radiologistSynthesisSchema,
} from './synthesize-radiologist-report'
import { isRadiologistReportCandidate } from './report-pipeline'

describe('buildDeterministicSynthesis', () => {
  it('produit un brief (headline + points clés), pas un dump de sections', () => {
    const sections = structureRadiologistReport(`
INDICATION : Rachialgie lombaire chronique.

TECHNIQUE : IRM 1,5 T.

RÉSULTATS : Discopathie L4-L5. Bombement discal postérieur. Pas de sténose canalaire.

CONCLUSION : Discopathie L4-L5 sans conflit radiculaire franc.
`)
    const synth = buildDeterministicSynthesis(sections, 'cr-irm.pdf')
    expect(radiologistSynthesisSchema.safeParse(synth).success).toBe(true)
    expect(synth.headline.toLowerCase()).toMatch(/discopathie|l4/)
    expect(synth.keyFindings.length).toBeGreaterThanOrEqual(1)
    expect(synth.keyFindings.length).toBeLessThanOrEqual(6)
    expect(synth.conclusion.toLowerCase()).toMatch(/discopathie|conflit/)
    // Pas un collage de toutes les sections brutes
    expect(synth.keyFindings.join(' ')).not.toMatch(/TECHNIQUE/)
  })
})

describe('isRadiologistReportCandidate', () => {
  it('accepte PDF CR et DOC DICOM, refuse questionnaires', () => {
    expect(
      isRadiologistReportCandidate({
        file_name: 'Document — REPORT PDF.dcm',
        kind: 'dicom',
        modality: 'DOC',
      }),
    ).toBe(true)
    expect(
      isRadiologistReportCandidate({
        file_name: 'cr-irm.pdf',
        kind: 'document',
        mime_type: 'application/pdf',
      }),
    ).toBe(true)
    expect(
      isRadiologistReportCandidate({
        file_name: 'Questionnaire médical.pdf',
        kind: 'document',
        mime_type: 'application/pdf',
      }),
    ).toBe(false)
  })
})
