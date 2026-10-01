/**
 * Synthèse structurée d’un compte rendu radiologue pour le staff clinique.
 * Ancrée au texte source : pas de diagnostic inventé, pas de valeur inventée.
 */

import { z } from 'zod'
import {
  ABSENT_SECTION_LABEL,
  type ReportSection,
} from '@/lib/documents/structure-radiologist-report'
import {
  REPORT_READ_REV,
  stripReportBoilerplate,
  tidyReportLine,
} from '@/lib/documents/report-triage'

export const radiologistSynthesisSchema = z.object({
  /** Une ligne : ce que le pro doit retenir en premier. */
  headline: z.string().min(1).max(280),
  /** Contexte / indication (issu du document). */
  context: z.string().max(600),
  /** 2 à 6 points clés (phrases du document reformulées brièvement). */
  keyFindings: z.array(z.string().min(1).max(320)).min(1).max(8),
  /** Conclusion radiologue (si présente). */
  conclusion: z.string().max(800),
  /** Sections absentes du PDF (transparence). */
  absentNotes: z.array(z.string().max(120)).max(6),
})

export type RadiologistSynthesis = z.infer<typeof radiologistSynthesisSchema>

function sectionText(sections: ReportSection[], id: ReportSection['id']): string | null {
  const s = sections.find(x => x.id === id)
  if (!s?.present) return null
  const t = s.text.trim()
  if (!t || t === ABSENT_SECTION_LABEL) return null
  return t
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 12)
}

function splitFindings(text: string): string[] {
  const lines = stripReportBoilerplate(text)
    .split(/\n+/)
    .map(tidyReportLine)
    .filter(s => s.length > 12)
  if (lines.length >= 2) return lines.slice(0, 5)
  return splitSentences(stripReportBoilerplate(text))
    .map(tidyReportLine)
    .filter(s => s.length > 12)
    .slice(0, 5)
}

function firstClinicalSentence(text: string): string {
  const cleaned = tidyReportLine(stripReportBoilerplate(text).split('\n')[0] ?? text)
  const sentence = cleaned.split(/(?<=[.!?…])\s+/)[0] ?? cleaned
  if (sentence.length > 180) return `${sentence.slice(0, 177).trim()}…`
  return sentence
}

/**
 * Brief déterministe (sans LLM) : priorise conclusion + résultats,
 * jamais un dump de toutes les sections.
 */
export function buildDeterministicSynthesis(
  sections: ReportSection[],
  fileName?: string | null,
): RadiologistSynthesis {
  const indication = sectionText(sections, 'indication')
  const resultats = sectionText(sections, 'resultats')
  const conclusion = sectionText(sections, 'conclusion')
  const technique = sectionText(sections, 'technique')
  const avis = sectionText(sections, 'avis')

  const presentCount = sections.filter(s => s.present).length
  const absentNotes =
    presentCount >= 2
      ? sections.filter(s => !s.present).map(s => `${s.title} non mentionné dans le document`)
      : []

  const findingSource = resultats ?? avis ?? conclusion ?? indication ?? ''
  const findings = splitFindings(findingSource)
  const keyFindings =
    findings.length > 0
      ? findings
      : findingSource
        ? [findingSource.slice(0, 280)]
        : ['Aucun élément textuel exploitable dans le document.']

  const headlineSource =
    conclusion ?? findings[findings.length - 1] ?? indication ?? fileName ?? 'Compte rendu'
  const headline = firstClinicalSentence(headlineSource) || 'Compte rendu'

  const contextParts: string[] = []
  if (indication) contextParts.push(indication)
  if (technique) contextParts.push(`Technique : ${technique.slice(0, 200)}`)

  return radiologistSynthesisSchema.parse({
    headline,
    context: contextParts.join('\n\n').slice(0, 600),
    keyFindings,
    conclusion: tidyReportLine(stripReportBoilerplate(conclusion ?? avis ?? '')).slice(0, 800),
    absentNotes,
  })
}

const SYNTHESIS_SYSTEM = `Tu es un assistant de lecture pour des professionnels de santé (chirurgiens, médecins, assistants).
Tu produis une SYNTHÈSE courte et actionnable d'un compte rendu radiologue.

Règles STRICTES :
- Utilise UNIQUEMENT les informations présentes dans le texte fourni.
- N'invente AUCUN diagnostic, mesure, niveau vertébral, ni recommandation absente du texte.
- Si une info manque, ne la complète pas : note-la dans absentNotes.
- Français médical clair, phrases courtes.
- headline = la conclusion clinique en UNE phrase. Pas de nom, pas de date de naissance, pas de téléphone.
- keyFindings = 2 à 6 constatations cliniques (niveaux, sténose, conflit, technique utile). Jamais un pied de page.
- conclusion = reformulation concise de la conclusion radiologue si elle existe, sinon chaîne vide.
- Ignore totalement : coordonnées, sites web, adresses, numéros de dossier, mentions légales, publicités de rendez-vous, avis de reconnaissance vocale, pages « copie médecin référent ».`

/**
 * Synthèse via Vercel AI Gateway si configuré, sinon brief déterministe.
 * Ne loggue jamais le texte source (PHI).
 */
export async function synthesizeRadiologistReport(input: {
  sections: ReportSection[]
  rawText: string
  fileName?: string | null
}): Promise<{ synthesis: RadiologistSynthesis; model: string }> {
  const cleaned = stripReportBoilerplate(input.rawText)
  const fallback = buildDeterministicSynthesis(input.sections, input.fileName)
  // Production : AI_GATEWAY_API_KEY (Vercel AI Gateway). Le SDK la lit lui-même.
  // VERCEL_OIDC_TOKEN est un repli automatique sur Vercel ; ce n'est pas une clé à coller.
  const hasGateway = Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN)

  if (!hasGateway || cleaned.length < 40) {
    return { synthesis: fallback, model: `deterministic@${REPORT_READ_REV}` }
  }

  try {
    const { generateObject } = await import('ai')
    const { gateway } = await import('@ai-sdk/gateway')
    const modelId = process.env.RADIOLOGY_SYNTHESIS_MODEL || 'openai/gpt-5.4-mini'

    const { object } = await generateObject({
      model: gateway(modelId),
      schema: radiologistSynthesisSchema,
      system: SYNTHESIS_SYSTEM,
      prompt: [
        `Fichier: ${input.fileName ?? 'compte-rendu.pdf'}`,
        '',
        'Texte du compte rendu (source unique) :',
        cleaned.slice(0, 24000),
      ].join('\n'),
      temperature: 0.1,
    })

    return { synthesis: object, model: `${modelId}@${REPORT_READ_REV}` }
  } catch (err) {
    const status =
      typeof err === 'object' && err !== null && 'statusCode' in err
        ? (err as { statusCode?: number }).statusCode
        : undefined
    console.error('[radiology-synthesis] gateway fallback', { status: status ?? 'unknown' })
    return { synthesis: fallback, model: `deterministic@${REPORT_READ_REV}` }
  }
}
