import { describe, expect, it } from 'vitest'
import {
  needsQuestionnaireResyncConfirm,
  questionnaireResyncConfirmMessage,
} from './questionnaire-resync-confirm'

describe('needsQuestionnaireResyncConfirm', () => {
  it('is false when nothing changed', () => {
    expect(
      needsQuestionnaireResyncConfirm({
        languageDirty: false,
        formTypesChanged: false,
        questionnaireStatus: 'sent',
        hasActiveLink: true,
        hasInProgressSession: true,
      }),
    ).toBe(false)
  })

  it('requires confirm for language dirty after sent', () => {
    expect(
      needsQuestionnaireResyncConfirm({
        languageDirty: true,
        formTypesChanged: false,
        questionnaireStatus: 'sent',
        hasActiveLink: true,
        hasInProgressSession: false,
      }),
    ).toBe(true)
  })

  it('requires confirm for pathology change with in-progress session', () => {
    expect(
      needsQuestionnaireResyncConfirm({
        languageDirty: false,
        formTypesChanged: true,
        questionnaireStatus: null,
        hasActiveLink: false,
        hasInProgressSession: true,
      }),
    ).toBe(true)
  })

  it('does not require confirm for first send (no sent / link / session)', () => {
    expect(
      needsQuestionnaireResyncConfirm({
        languageDirty: true,
        formTypesChanged: false,
        questionnaireStatus: null,
        hasActiveLink: false,
        hasInProgressSession: false,
      }),
    ).toBe(false)
  })
})

describe('questionnaireResyncConfirmMessage', () => {
  it('mentions new session when pathology changes', () => {
    const msg = questionnaireResyncConfirmMessage({
      languageDirty: false,
      formTypesChanged: true,
      fromPathologyLabel: 'Cervical',
      toPathologyLabel: 'Lombaire',
    })
    expect(msg).toContain('Cervical')
    expect(msg).toContain('Lombaire')
    expect(msg).toContain('nouvelle session')
  })

  it('mentions language when only language dirty', () => {
    expect(
      questionnaireResyncConfirmMessage({
        languageDirty: true,
        formTypesChanged: false,
      }),
    ).toMatch(/langue/i)
  })
})
