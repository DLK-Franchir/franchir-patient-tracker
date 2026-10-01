import { describe, expect, it } from 'vitest'
import { structureRadiologistReport } from './structure-radiologist-report'
import { buildDeterministicSynthesis } from './synthesize-radiologist-report'
import {
  isClinicalReportText,
  isLikelyReportName,
  isTechnicalDocumentName,
  stripReportBoilerplate,
} from './report-triage'

const CLINICAL = `
Indication :
Patient de 79 ans avec décompression L4-L5. Claudication persistante.

Technique :
IRM colonne lombaire.

Constatations :
Artéfacts de mouvement. Sténose canalaire modérée L3-L4. Discopathie L4-L5.

Conclusion :
Interprétation limitée du fait de nombreux artéfacts de mouvement. L'examen est superposable au précédent.
COPIE MÉDECIN RÉFÉRANT Page 3 de 4
Au médecin référent exclusivement: n'hésitez pas à contacter le Service des rapports au 514-866-1809.
Accès rapide aux examens d'IRM.
Frais d'examens couverts par la plupart des régimes d'assurances.
Rendez-vous en ligne sur medvue.ca ou au 1-888-785-5214 Quick access to MRI.
Ce document a été généré par un logiciel de reconnaissance vocale.
`.trim()

const COVER = `
Imagix - Imagerie médicale
Pour obtenir un rendez-vous
1-866-916-6622
www.imagixmedical.com
Nom du patient: MARTIN, PAUL
Naissance: 1 janvier 1980
`.trim()

const LICENSE = `
SanDisk et le logo SanDisk sont des marques déposées de Western Digital Corporation.
Tous droits réservés. © 2021 Western Digital Corporation.
`.trim()

describe('tri des PDF', () => {
  it('écarte licence et page de garde, garde le compte rendu', () => {
    expect(isTechnicalDocumentName('SANDISK SOFTWARE.PDF')).toBe(true)
    expect(isTechnicalDocumentName('RAPPORT RADIOLOGISTE.pdf')).toBe(false)
    expect(isClinicalReportText(LICENSE)).toBe(false)
    expect(isClinicalReportText(COVER)).toBe(false)
    expect(isClinicalReportText(CLINICAL)).toBe(true)
    expect(isLikelyReportName('PATIENT_RESULTS_abc.pdf')).toBe(false)
    expect(isLikelyReportName('RAPPORT RADIOLOGISTE DU 14-03-2026.PDF')).toBe(true)
  })

  it('retire le pied de page collé à la conclusion', () => {
    const cleaned = stripReportBoilerplate(CLINICAL)
    expect(cleaned.toLowerCase()).toMatch(/sténose|stenose/)
    expect(cleaned.toLowerCase()).not.toMatch(/medvue|514-866|droits réservés|reconnaissance vocale/)

    const synth = buildDeterministicSynthesis(structureRadiologistReport(cleaned), 'rapport.pdf')
    const blob = `${synth.headline}\n${synth.keyFindings.join('\n')}\n${synth.conclusion}`.toLowerCase()
    expect(blob).toMatch(/artéfacts|artefacts/)
    expect(blob).toMatch(/sténose|stenose|discopathie/)
    expect(blob).not.toMatch(/medvue|514-|assurances|quick access/)
    expect(synth.headline.startsWith(':')).toBe(false)
  })
})
