import { describe, expect, it } from 'vitest'
import { extractPdfText, sha256Hex } from './extract-pdf-text'

/** PDF minimal avec une chaîne texte « INDICATION ». */
function minimalTextPdf(): Uint8Array {
  const pdf = `%PDF-1.1
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj
4 0 obj<< /Length 44 >>stream
BT /F1 24 Tf 100 100 Td (INDICATION) Tj ET
endstream
endobj
5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000274 00000 n 
0000000362 00000 n 
trailer<< /Size 6 /Root 1 0 R >>
startxref
441
%%EOF`
  return new TextEncoder().encode(pdf)
}

describe('extractPdfText', () => {
  it('extrait la couche texte numérique', async () => {
    const text = await extractPdfText(minimalTextPdf())
    expect(text).toMatch(/INDICATION/)
  })

  it('sha256Hex est déterministe', () => {
    const bytes = new Uint8Array([1, 2, 3])
    expect(sha256Hex(bytes)).toBe(sha256Hex(bytes))
    expect(sha256Hex(bytes)).toHaveLength(64)
  })
})
