import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AnamnezeDashboard } from '@/components/patient/synthesis/anamneze-dashboard'
import type { QuestionnaireSynthesisPreview } from '@/lib/integrations/questionnaire-synthesis-preview.types'

const preview: QuestionnaireSynthesisPreview = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  generatedAt: '2026-06-01T10:00:00.000Z',
  profile: {
    reason: 'Douleur cervicale',
    gender: 'Femme',
  },
  flags: [{ id: 'f1', label: 'Allergie latex', severity: 'critical', icon: 'allergy' }],
  antecedents: [{ title: 'Medicaux', items: ['HTA'] }],
  treatments: [{ name: 'Ibuprofene', status: 'actif' }],
  timeline: [{ id: 't1', label: 'Motif', detail: 'Douleur', sortKey: 1 }],
  imagingRows: [
    {
      id: 'img1',
      name: 'IRM cervicale',
      result: 'Disponible',
      status: 'disponible',
    },
  ],
  scores: {
    eva: 6,
    evaInterpretation: 'Moderee',
    ndiPct: 30,
    ndiLabel: 'Moderate',
  },
  completion: {
    overall: 100,
    status: 'completed',
    sections: [{ title: 'Symptomes', pct: 100 }],
  },
}

describe('AnamnezeDashboard', () => {
  it('rend les cartes principales de synthese', () => {
    const html = renderToStaticMarkup(
      <AnamnezeDashboard patientName="Jane Doe" preview={preview} />,
    )
    expect(html).toContain('Profil patient')
    expect(html).toContain('Drapeaux cliniques')
    expect(html).toContain('Scores fonctionnels')
    expect(html).toContain('Douleur cervicale')
    expect(html).toContain('Allergie latex')
  })
})
