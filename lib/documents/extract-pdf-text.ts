/**
 * Extraction de texte PDF via pdf.js (couche texte numérique uniquement).
 * Pas d'OCR : un scan sans texte → chaîne vide (statut `no_text` côté route).
 */

import { createHash } from 'node:crypto'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

let workerConfigured = false

async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  if (!workerConfigured) {
    // Sans workerSrc, pdf.js plante en Node/serverless :
    // « Setting up fake worker failed: No GlobalWorkerOptions.workerSrc specified ».
    const workerPath = path.join(
      process.cwd(),
      'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
    )
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href
    workerConfigured = true
  }
  return pdfjs
}

/**
 * Copie défensive : pdf.js refuse un `Buffer` Node et peut échouer sur une
 * vue Uint8Array dont le buffer sous-jacent est partagé / détaché.
 */
function toPdfData(pdfBytes: Uint8Array): Uint8Array {
  return pdfBytes.byteOffset === 0 && pdfBytes.byteLength === pdfBytes.buffer.byteLength
    ? pdfBytes.slice()
    : new Uint8Array(pdfBytes)
}

/**
 * Extrait le texte de toutes les pages. Retourne '' si aucune couche texte.
 * Ne loggue jamais le contenu (PHI).
 */
export async function extractPdfText(pdfBytes: Uint8Array): Promise<string> {
  const pdfjs = await loadPdfjs()
  const data = toPdfData(pdfBytes)
  const loadingTask = pdfjs.getDocument({
    data,
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
