/**
 * Extraction de texte PDF (couche texte numérique, pas d'OCR).
 * `unpdf` embarque pdf.js sans worker fichier — fiable en serverless Vercel.
 */

import { createHash } from 'node:crypto'
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
 * Extrait le texte de toutes les pages. Retourne '' si aucune couche texte.
 * Ne loggue jamais le contenu (PHI).
 */
export async function extractPdfText(pdfBytes: Uint8Array): Promise<string> {
  const data = toPdfData(pdfBytes)
  const doc = await getDocumentProxy(data)
  const { text } = await extractText(doc, { mergePages: true })
  const joined = (Array.isArray(text) ? text.join('\n\n') : String(text ?? ''))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
  return joined
}
