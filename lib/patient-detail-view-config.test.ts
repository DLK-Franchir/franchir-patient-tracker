import { describe, expect, it } from 'vitest'
import { getPatientDetailViewConfig } from './patient-detail-view-config'

describe('getPatientDetailViewConfig', () => {
  it('restreint la vue Gilles au mode validation medicale', () => {
    const view = getPatientDetailViewConfig('gilles')
    expect(view).toEqual({
      showSharePoint: false,
      canManageDocuments: false,
      showCommercialTab: false,
      canManageQuestionnaire: false,
      showQuestionnairePdf: true,
      showAnamnezeDashboard: true,
      showClinicalSummary: true,
    })
  })

  it('conserve le comportement standard pour marcel avec synthese PDF et dashboard Anamneze', () => {
    const view = getPatientDetailViewConfig('marcel')
    expect(view.showSharePoint).toBe(true)
    expect(view.canManageDocuments).toBe(true)
    expect(view.showCommercialTab).toBe(true)
    expect(view.canManageQuestionnaire).toBe(true)
    expect(view.showQuestionnairePdf).toBe(true)
    expect(view.showAnamnezeDashboard).toBe(true)
  })

  it('conserve le comportement standard pour franchir sans synthese medicale', () => {
    const view = getPatientDetailViewConfig('franchir')
    expect(view.showSharePoint).toBe(true)
    expect(view.showQuestionnairePdf).toBe(false)
    expect(view.showAnamnezeDashboard).toBe(false)
  })
})
