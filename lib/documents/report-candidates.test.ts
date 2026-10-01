import { describe, expect, it } from 'vitest'
import { isRadiologistReportCandidate, reportNeedsFreshSynthesis } from './report-candidates'
import { readReportPdfBytes } from './read-report-pdf'
import { extractReportTextFromFile } from './extract-report-text'

function appendExplicitTag(
  chunks: number[],
  group: number,
  element: number,
  vr: string,
  value: Uint8Array | string,
): void {
  chunks.push(group & 0xff, (group >> 8) & 0xff)
  chunks.push(element & 0xff, (element >> 8) & 0xff)
  chunks.push(vr.charCodeAt(0)!, vr.charCodeAt(1)!)
  const valueBytes = typeof value === 'string' ? new TextEncoder().encode(value) : value
  const longVr = new Set(['OB', 'OW', 'OF', 'SQ', 'UT', 'UN', 'UC'])
  if (longVr.has(vr)) {
    chunks.push(0, 0)
    let len = valueBytes.length
    if (len % 2 !== 0) len += 1
    chunks.push(len & 0xff, (len >> 8) & 0xff, (len >> 16) & 0xff, (len >> 24) & 0xff)
    for (const b of valueBytes) chunks.push(b)
    if (valueBytes.length % 2 !== 0) chunks.push(0)
    return
  }
  let len = valueBytes.length
  if (len % 2 !== 0) len += 1
  chunks.push(len & 0xff, (len >> 8) & 0xff)
  for (const b of valueBytes) chunks.push(b)
  if (valueBytes.length % 2 !== 0) chunks.push(0)
}

describe('isRadiologistReportCandidate', () => {
  it('garde le PDF DICOM REPORT et ignore Phoenix / questionnaires', () => {
    expect(
      isRadiologistReportCandidate({
        fileName: 'SE000004_IM000001.dcm',
        seriesDescription: 'REPORT PDF',
        kind: 'dicom',
        modality: 'DOC',
      }),
    ).toBe(true)
    expect(
      isRadiologistReportCandidate({
        fileName: 'PhoenixZIPReport',
        seriesDescription: 'PhoenixZIPReport',
        kind: 'dicom',
        modality: 'DOC',
      }),
    ).toBe(false)
    expect(
      isRadiologistReportCandidate({
        fileName: 'Questionnaire médical.pdf',
        kind: 'document',
        mimeType: 'application/pdf',
      }),
    ).toBe(false)
    expect(
      isRadiologistReportCandidate({
        fileName: 'cr-irm.pdf',
        kind: 'document',
        mimeType: 'application/pdf',
      }),
    ).toBe(true)
  })
})

describe('reportNeedsFreshSynthesis', () => {
  it('relit les erreurs et saute une synthèse déjà prête', () => {
    expect(reportNeedsFreshSynthesis(undefined, false)).toBe(true)
    expect(reportNeedsFreshSynthesis({ status: 'error', synthesis_status: 'error' }, false)).toBe(true)
    expect(reportNeedsFreshSynthesis({ status: 'ok', synthesis_status: 'ok' }, false)).toBe(false)
    expect(reportNeedsFreshSynthesis({ status: 'ok', synthesis_status: 'ok' }, true)).toBe(true)
    expect(reportNeedsFreshSynthesis({ status: 'no_text', synthesis_status: 'skipped' }, false)).toBe(
      false,
    )
  })
})

describe('readReportPdfBytes', () => {
  it('lit le PDF encapsulé via dicom-parser', () => {
    const pdf = '%PDF-1.4\nCONCLUSION Discopathie\n%%EOF'
    const chunks: number[] = new Array(128).fill(0)
    chunks.push(0x44, 0x49, 0x43, 0x4d)
    appendExplicitTag(chunks, 0x0002, 0x0010, 'UI', '1.2.840.10008.1.2.1\0')
    appendExplicitTag(chunks, 0x0008, 0x0060, 'CS', 'DOC ')
    appendExplicitTag(chunks, 0x0042, 0x0011, 'OB', new TextEncoder().encode(pdf))
    const bytes = readReportPdfBytes(new Uint8Array(chunks), {
      kind: 'dicom',
      fileName: 'report.dcm',
      mimeType: 'application/dicom',
    })
    expect(bytes).not.toBeNull()
    expect(new TextDecoder().decode(bytes!)).toMatch(/^%PDF-1\.4/)
    expect(new TextDecoder().decode(bytes!)).toMatch(/%%EOF/)
  })
})

function minimalTextPdf(): Uint8Array {
  const pdf = `%PDF-1.1
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj
4 0 obj<< /Length 68 >>stream
BT /F1 12 Tf 40 100 Td (CONCLUSION : Discopathie L4-L5.) Tj ET
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
0000000390 00000 n 
trailer<< /Size 6 /Root 1 0 R >>
startxref
469
%%EOF`
  return new TextEncoder().encode(pdf)
}

describe('extractReportTextFromFile', () => {
  it('lit le texte d’un PDF encapsulé dans un DICOM DOC', async () => {
    const pdf = minimalTextPdf()
    const chunks: number[] = new Array(128).fill(0)
    chunks.push(0x44, 0x49, 0x43, 0x4d)
    appendExplicitTag(chunks, 0x0002, 0x0010, 'UI', '1.2.840.10008.1.2.1\0')
    appendExplicitTag(chunks, 0x0008, 0x0060, 'CS', 'DOC ')
    appendExplicitTag(chunks, 0x0042, 0x0011, 'OB', pdf)
    const result = await extractReportTextFromFile(new Uint8Array(chunks), {
      kind: 'dicom',
      fileName: 'SE000004_IM000001.dcm',
      mimeType: 'application/dicom',
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.text).toMatch(/Discopathie L4-L5/)
  })
})
