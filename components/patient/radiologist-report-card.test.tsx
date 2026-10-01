import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { RadiologistReportCard } from '@/components/patient/radiologist-report-card'
import { ABSENT_SECTION_LABEL } from '@/lib/documents/structure-radiologist-report'

describe('RadiologistReportCard', () => {
  it('affiche la mention fixe et les sections sans interprétation', () => {
    const html = renderToStaticMarkup(
      <RadiologistReportCard
        report={{
          id: 'r1',
          document_id: 'd1',
          status: 'ok',
          extracted_at: '2026-10-01T00:00:00Z',
          file_name: 'cr-irm.pdf',
          source_url: 'https://example.test/cr.pdf',
          sections: [
            { id: 'indication', title: 'Indication', text: 'Rachialgie', present: true },
            {
              id: 'technique',
              title: 'Technique',
              text: ABSENT_SECTION_LABEL,
              present: false,
            },
            { id: 'resultats', title: 'Résultats', text: 'Discopathie', present: true },
            { id: 'conclusion', title: 'Conclusion', text: 'RAS', present: true },
            { id: 'avis', title: 'Avis', text: ABSENT_SECTION_LABEL, present: false },
          ],
        }}
      />
    )
    expect(html).toContain('Extrait du document, sans interprétation')
    expect(html).toContain('Rachialgie')
    expect(html).toContain(ABSENT_SECTION_LABEL)
    expect(html).toContain('Voir le PDF source')
    expect(html).toContain('data-testid="radiologist-report-sections"')
  })

  it('état no_text invite à ouvrir le PDF', () => {
    const html = renderToStaticMarkup(
      <RadiologistReportCard
        report={{
          id: 'r2',
          document_id: 'd2',
          status: 'no_text',
          extracted_at: '2026-10-01T00:00:00Z',
          sections: [],
        }}
      />
    )
    expect(html).toContain('data-testid="radiologist-report-no-text"')
    expect(html).toMatch(/Ouvrir le PDF/i)
  })
})
