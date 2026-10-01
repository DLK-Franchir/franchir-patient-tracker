/**
 * Extraction de texte PDF via pdf.js (couche texte numérique uniquement).
 * Pas d'OCR : un scan sans texte → chaîne vide (statut `no_text` côté route).
 */

import { createHash } from 'node:crypto'

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/**
 * Extrait le texte de toutes les pages. Retourne '' si aucune couche texte.
 * Ne loggue jamais le contenu (PHI).
 */
export async function extractPdfText(pdfBytes: Uint8Array): Promise<string> {
  // Legacy build Node-friendly (pas de worker obligatoire).
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const loadingTask = pdfjs.getDocument({
    data: pdfBytes,
    useSystemFonts: true,
    isEvalSupported: false,
    useWorkerFetch: false,
    disableFontFace: true,
  })
  const doc = await loadingTask.promise
  const parts: string[] = []
  try {
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
      const page = await doc.getPage(pageNum)
      const content = await page.getTextContent()
      const pageText = content.items
        .map(item => ('str' in item && typeof item.str === 'string' ? item.str : ''))
        .join(' ')
        .replace(/[ \t]+/g, ' ')
        .trim()
      if (pageText) parts.push(pageText)
    }
  } finally {
    await doc.destroy()
  }
  return parts.join('\n\n').trim()
}
