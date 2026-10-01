/**
 * Extraction de texte PDF (couche texte numérique, pas d'OCR).
 * `unpdf` embarque pdf.js sans worker fichier — fiable en serverless Vercel.
 */

import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { extractText, getDocumentProxy } from 'unpdf'
import { findPdfSlice } from '@/lib/documents/pdf-bytes'

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function toPdfData(pdfBytes: Uint8Array): Uint8Array {
  const sliced = findPdfSlice(pdfBytes) ?? pdfBytes
  return sliced.byteOffset === 0 && sliced.byteLength === sliced.buffer.byteLength
    ? sliced.slice()
    : new Uint8Array(sliced)
}

/**
 * Polices standard pdf.js (Helvetica, Times…) absentes du trace Vercel par défaut.
 * Sans ce dossier, getTextContent lève une exception sur un CR médical typique.
 */
function pdfJsNodeOptions(): {
  disableFontFace?: boolean
  standardFontDataUrl?: string
  cMapUrl?: string
  cMapPacked?: boolean
  useSystemFonts?: boolean
} {
  const bases = [process.cwd()]
  for (const base of bases) {
    try {
      const require = createRequire(path.join(base, 'package.json'))
      const root = path.dirname(require.resolve('pdfjs-dist/package.json'))
      const fontDir = path.join(root, 'standard_fonts')
      const cmapDir = path.join(root, 'cmaps')
      if (!existsSync(path.join(fontDir, 'FoxitSerif.pfb'))) continue
      return {
        disableFontFace: true,
        useSystemFonts: true,
        standardFontDataUrl: pathToFileURL(fontDir + path.sep).href,
        cMapUrl: pathToFileURL(cmapDir + path.sep).href,
        cMapPacked: true,
      }
    } catch {
      // package absent du bundle : unpdf retentera ses propres défauts
    }
  }
  return { useSystemFonts: true }
}

/**
 * Extrait le texte de toutes les pages. Retourne '' si aucune couche texte.
 * Ne loggue jamais le contenu (PHI).
 */
export async function extractPdfText(pdfBytes: Uint8Array): Promise<string> {
  const data = toPdfData(pdfBytes)
  const doc = await getDocumentProxy(data, pdfJsNodeOptions())
  const { text } = await extractText(doc, { mergePages: true })
  const joined = (Array.isArray(text) ? text.join('\n\n') : String(text ?? ''))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
  return joined
}
