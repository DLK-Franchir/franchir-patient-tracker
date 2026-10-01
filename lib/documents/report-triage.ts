/**
 * Tri des documents avant synthèse : écarter les PDF techniques (CD, licence)
 * et les pages de garde, ne garder qu'un texte de compte rendu clinique.
 * Aucune donnée patient n'est loguée.
 */

/**
 * Incrémenté quand le tri ou le moteur de synthèse change.
 * Les cartes déjà enregistrées sans cette révision sont relues une fois.
 */
export const REPORT_READ_REV = 'gateway-1'

const TECHNICAL_NAME =
  /sandisk|western\s*digital|winzip|readme|autorun|eula|\blicen[cs]e\b|\blicence\b|copyright|phoenix|dicomdir|weasis|osirix|radiantviewer|ezdicom|horos|\bsetup\b|\binstall\b|mode d'emploi|notice logicielle|software\.pdf/

const BOILERPLATE_LINE =
  /sandisk|western digital|marque d[ée]pos[ée]e|appellation commerciale|tous droits r[ée]serv[ée]s|copyright|©/i

const FOOTER_LINE =
  /www\.|https?:\/\/|reconnaissance vocale|copie m[ée]decin|page\s+\d+\s*(de|\/)\s*\d+|n'h[ée]sitez pas|service des rapports|acc[èe]s rapide aux examens|frais d'examens|r[ée]gimes d'assurances|rendez-vous en ligne|quick access|medvue|nom du patient|date de naissance|^naissance\b|dossier\s*n[°o]|n[°o]\s*de dossier/i

const PHONE_LINE = /\b\d{1,3}[-.\s]\d{3}[-.\s]\d{3,4}\b/

const POSTAL_CA = /\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/

/**
 * Signal clinique fort. Un simple mot « Interprétation » (page de garde)
 * ne suffit pas : il faut une modalité ou une constatation.
 */
const CLINICAL_SIGNAL =
  /\b(irm|tdm|scanner|tomodensit\w*|radiograph\w*|[ée]chograph\w*|discopath\w*|st[ée]nose\w*|hernie\w*|foram\w*|radicul\w*|arthrose\w*|protrusion\w*|canal\s+(lombaire|cervical)|compte[\s-]?rendu|rapport\s+radiolog\w*|constatation\w*)\b/i

export function isTechnicalDocumentName(name: string): boolean {
  return TECHNICAL_NAME.test(name.toLowerCase())
}

/** Nom qui ressemble à un compte rendu (pour afficher un échec de lecture). */
export function isLikelyReportName(name: string): boolean {
  return /rapport|compte[\s-]?rendu|radiolog|report\s*pdf|\bcr\b/i.test(name)
}

export function tidyReportLine(line: string): string {
  return line
    .replace(/^[\s:：;|•*\-–—]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isBoilerplateLine(line: string): boolean {
  const t = line.trim()
  if (t.length < 3) return true
  if (BOILERPLATE_LINE.test(t) || FOOTER_LINE.test(t)) return true
  if (PHONE_LINE.test(t)) return true
  if (POSTAL_CA.test(t) && t.length < 180) return true
  if (/^\s*t[ée]l\.?\s*:/i.test(t)) return true
  return false
}

/** Coupe un paragraphe collé par pdf.js dès qu'un pied de page commence. */
function separateFooterChunks(raw: string): string {
  return raw
    .replace(/\s+(COPIE M[ÉE]DECIN)/gi, '\n$1')
    .replace(/\s+(Page\s+\d+\s+(?:de|\/)\s+\d+)/gi, '\n$1')
    .replace(/\s+(Ce document a [ée]t[ée] g[ée]n[ée]r[ée])/gi, '\n$1')
    .replace(/\s+(Rendez-vous en ligne)/gi, '\n$1')
    .replace(/\s+(Au m[ée]decin r[ée]f[ée]rant)/gi, '\n$1')
    .replace(/\s+(Nom du patient\s*:)/gi, '\n$1')
    .replace(/\s+(Naissance\s*:)/gi, '\n$1')
    .replace(/\s+(Date de naissance\s*:)/gi, '\n$1')
    .replace(/\s+(T[ée]l\.?\s*:)/gi, '\n$1')
    .replace(/\s+(Acc[èe]s rapide aux examens)/gi, '\n$1')
    .replace(/\s+(Frais d'examens)/gi, '\n$1')
}

/** Retire pieds de page, licences et lignes d'identité administrative. */
export function stripReportBoilerplate(raw: string): string {
  const lines = separateFooterChunks(raw)
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(tidyReportLine)
    .filter(line => line.length > 0 && !isBoilerplateLine(line))
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * Vrai compte rendu (texte clinique). Faux pour une licence, une page de garde
 * Imagix, ou un PDF sans constatation exploitable.
 */
export function isClinicalReportText(raw: string): boolean {
  const original = raw.replace(/\u0000/g, '').trim()
  if (original.length < 40) return false
  const cleaned = stripReportBoilerplate(original)
  if (cleaned.length < 40) return false
  if (BOILERPLATE_LINE.test(original) && !CLINICAL_SIGNAL.test(cleaned)) return false
  if (/nom du patient|date de naissance|^naissance\b/im.test(original) && !CLINICAL_SIGNAL.test(cleaned)) {
    return false
  }
  return CLINICAL_SIGNAL.test(cleaned)
}
