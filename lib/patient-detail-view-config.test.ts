import { describe, expect, it } from 'vitest'
import { getPatientDetailViewConfig } from './patient-detail-view-config'

describe('getPatientDetailViewConfig', () => {
  it('restreint la vue Gilles au mode validation médicale', () => {
    const view = getPatientDetailViewConfig('gilles')
    expect(view).toEqual({
      showSharePoint: false,
      showSurgeonAssignment: false,
      canManageDocuments: false,
      showCommercialTab: false,
      canManageQuestionnaire: false,
      showQuestionnairePdf: true,
    })
  })

  it('conserve le comportement standard pour marcel avec synthèse PDF en lecture', () => {
    const view = getPatientDetailViewConfig('marcel')
    expect(view.showSharePoint).toBe(true)
    expect(view.showSurgeonAssignment).toBe(true)
    expect(view.canManageDocuments).toBe(true)
    expect(view.showCommercialTab).toBe(true)
    expect(view.canManageQuestionnaire).toBe(true)
    expect(view.showQuestionnairePdf).toBe(true)
  })

  it('conserve le comportement standard pour franchir sans synthèse PDF', () => {
    const view = getPatientDetailViewConfig('franchir')
    expect(view.showSharePoint).toBe(true)
    expect(view.showQuestionnairePdf).toBe(false)
  })
})
