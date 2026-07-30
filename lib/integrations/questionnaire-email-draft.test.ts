import { describe, expect, it } from 'vitest'
import {
  buildMailtoHref,
  buildQuestionnaireEmailDraft,
  composeDispatchClipboardText,
  QUESTIONNAIRE_EMAIL_SUBJECT_EN,
  QUESTIONNAIRE_EMAIL_SUBJECT_FR,
} from '@/lib/integrations/questionnaire-email-draft'

describe('buildQuestionnaireEmailDraft', () => {
  it('produit un brouillon FR avec le lien', () => {
    const draft = buildQuestionnaireEmailDraft({
      language: 'fr',
      formTypes: ['cervical'],
      patientName: 'Jean',
      questionnaireUrl: 'https://questionnaire.franchir.eu/p/abc',
    })
    expect(draft.subject).toBe(QUESTIONNAIRE_EMAIL_SUBJECT_FR)
    expect(draft.textBody).toContain('Bonjour Jean,')
    expect(draft.textBody).toContain('https://questionnaire.franchir.eu/p/abc')
    expect(draft.textBody).toContain('Cervical')
  })

  it('produit un brouillon EN', () => {
    const draft = buildQuestionnaireEmailDraft({
      language: 'en',
      formTypes: ['lombaire'],
      questionnaireUrl: 'https://questionnaire.franchir.eu/p/xyz',
    })
    expect(draft.subject).toBe(QUESTIONNAIRE_EMAIL_SUBJECT_EN)
    expect(draft.textBody).toContain('Hello,')
    expect(draft.textBody).toContain('https://questionnaire.franchir.eu/p/xyz')
  })
})

describe('composeDispatchClipboardText / mailto', () => {
  it('compose un bloc collable', () => {
    const text = composeDispatchClipboardText({
      to: 'a@example.com',
      subject: 'Sujet',
      textBody: 'Corps',
    })
    expect(text).toBe('À : a@example.com\nObjet : Sujet\n\nCorps')
  })

  it('construit un mailto encodé', () => {
    const href = buildMailtoHref({
      to: 'a@example.com',
      subject: 'Votre questionnaire',
      textBody: 'Lien\nhttps://example.com',
    })
    expect(href.startsWith('mailto:a%40example.com?')).toBe(true)
    expect(href).toContain('subject=')
    expect(href).toContain('body=')
  })
})
