/**
 * Lecture de la couche texte d'un compte rendu (PDF nu ou encapsulé DICOM).
 * Destiné au navigateur : pdf.js y dispose des polices système, contrairement
 * au runtime serverless. Ne jamais logger le texte (PHI).
 */

import { reportPdfAttempts } from '@/lib/documents/read-report-pdf'

export const MAX_REPORT_TEXT_CHARS = 80_000

export type ReportTextHint = {
  kind?: string | null
  fileName?: string | null
  mimeType?: string | null
}

export type ReportTextResult =
  | { ok: true; text: string }
  | { ok: false; error: string }

function normalizeText(text: unknown): string {
  const raw = Array.isArray(text) ? text.join('\n\n') : String(text ?? '')
  return raw
    .replace(/\u0000/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

async function readWithUnpdf(data: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import('unpdf')
  const inBrowser = typeof window !== 'undefined'
  const doc = await getDocumentProxy(data.slice(), {
    useSystemFonts: true,
    ...(inBrowser ? { disableFontFace: false } : {}),
  })
  const { text } = await extractText(doc, { mergePages: true })
  return normalizeText(text)
}

function missingPdfError(hint: ReportTextHint): string {
  const mime = (hint.mimeType ?? '').toLowerCase()
  const name = (hint.fileName ?? '').toLowerCase()
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'not_a_pdf'
  return 'no_encapsulated_pdf'
}

/**
 * Essaie chaque découpe PDF (tag DICOM, puis %PDF brut) et garde le texte le plus long.
 */
export async function extractReportTextFromFile(
  fileBytes: Uint8Array,
  hint: ReportTextHint = {},
): Promise<ReportTextResult> {
  if (fileBytes.byteLength > 32 * 1024 * 1024) {
    return { ok: false, error: 'unsupported_mime' }
  }
  const attempts = reportPdfAttempts(fileBytes, hint)
  if (attempts.length === 0) return { ok: false, error: missingPdfError(hint) }

  let best = ''
  let sawEmpty = false
  let lastError = 'extract_failed'
  for (const pdf of attempts) {
    try {
      const text = await readWithUnpdf(pdf)
      if (!text) {
        sawEmpty = true
        continue
      }
      if (text.length > best.length) best = text
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      lastError = /workerSrc|fake worker/i.test(message) ? 'worker_unavailable' : 'extract_failed'
    }
  }
  if (best) return { ok: true, text: best.slice(0, MAX_REPORT_TEXT_CHARS) }
  if (sawEmpty) return { ok: false, error: 'no_text_layer' }
  return { ok: false, error: lastError }
}
