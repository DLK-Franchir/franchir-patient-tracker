/**
 * Structuration déterministe d'un compte rendu radiologue à partir du texte PDF.
 * Aucune interprétation : seules les phrases du document sont conservées.
 * Sections absentes → « non mentionné dans le document ».
 */

export const REPORT_SECTION_IDS = [
  'indication',
  'technique',
  'resultats',
  'conclusion',
  'avis',
] as const

export type ReportSectionId = (typeof REPORT_SECTION_IDS)[number]

export type ReportSection = {
  id: ReportSectionId
  title: string
  /** Texte extrait du PDF, ou message fixe si absent. */
  text: string
  present: boolean
}

export type ReportExtractStatus = 'ok' | 'no_text' | 'error'

export const ABSENT_SECTION_LABEL = 'non mentionné dans le document'

const SECTION_TITLES: Record<ReportSectionId, string> = {
  indication: 'Indication',
  technique: 'Technique',
  resultats: 'Résultats',
  conclusion: 'Conclusion',
  avis: 'Avis',
}

/** Mots-clés de titre (début de ligne), normalisés sans accents. */
const HEADER_ALIASES: { id: ReportSectionId; aliases: string[] }[] = [
  {
    id: 'indication',
    aliases: ['indication', 'indications', 'motif', 'motif de lexamen', 'renseignements cliniques'],
  },
  {
    id: 'technique',
    aliases: ['technique', 'protocole', 'materiel', 'materiel et methodes'],
  },
  {
    id: 'resultats',
    aliases: ['resultat', 'resultats', 'description', 'analyse', 'observation', 'observations'],
  },
  {
    id: 'conclusion',
    aliases: ['conclusion', 'conclusions', 'synthese', 'en conclusion'],
  },
  {
    id: 'avis',
    aliases: ['avis', 'commentaire', 'commentaire du radiologue', 'opinion'],
  },
]

function normalizeLine(line: string): string {
  return line
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function matchSectionHeader(line: string): { id: ReportSectionId; rest: string } | null {
  const raw = line.trim()
  if (!raw) return null
  const normalized = normalizeLine(raw)

  for (const { id, aliases } of HEADER_ALIASES) {
    for (const alias of aliases) {
      if (normalized === alias) {
        return { id, rest: '' }
      }
      if (normalized.startsWith(`${alias}:`) || normalized.startsWith(`${alias}.`) || normalized.startsWith(`${alias} -`)) {
        const rest = raw.replace(new RegExp(`^[^:.\-]+[:.\-]\\s*`, 'i'), '').trim()
        return { id, rest }
      }
      // « INDICATION rachialgie… » sans séparateur
      if (normalized.startsWith(`${alias} `) && normalized.length > alias.length + 1) {
        // Éviter de matcher « conclusions » dans une phrase longue hors titre
        const after = normalized.slice(alias.length).trim()
        if (after.length < 80) {
          const rest = raw.slice(raw.length - after.length).trim()
          return { id, rest }
        }
      }
    }
  }
  return null
}

/**
 * Découpe le texte brut PDF en sections FR connues.
 */
export function structureRadiologistReport(rawText: string): ReportSection[] {
  const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  // pdf.js joint souvent les lignes par espaces : re-split sur titres en bloc.
  const soft = normalized.replace(
    /\b(INDICATIONS?|TECHNIQUE|PROTOCOLE|R[ÉE]SULTATS?|CONCLUSIONS?|AVIS|DESCRIPTION|OBSERVATIONS?)\b/gi,
    '\n$1',
  )
  const lines = soft.split('\n')

  const buckets: Record<ReportSectionId, string[]> = {
    indication: [],
    technique: [],
    resultats: [],
    conclusion: [],
    avis: [],
  }

  let current: ReportSectionId | null = null

  for (const line of lines) {
    const header = matchSectionHeader(line)
    if (header) {
      current = header.id
      if (header.rest) buckets[current].push(header.rest)
      continue
    }
    if (current && line.trim()) {
      buckets[current].push(line.trim())
    }
  }

  return REPORT_SECTION_IDS.map(id => {
    const joined = buckets[id].join('\n').trim()
    const present = joined.length > 0
    return {
      id,
      title: SECTION_TITLES[id],
      text: present ? joined : ABSENT_SECTION_LABEL,
      present,
    }
  })
}

/** True si au moins une section a du contenu issu du PDF. */
export function reportHasExtractedContent(sections: ReportSection[]): boolean {
  return sections.some(s => s.present)
}
