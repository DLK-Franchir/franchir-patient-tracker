import { describe, expect, it } from 'vitest'
import {
  computeDashboardSummary,
  getFocusPatientIds,
  getPipelinePatientIds,
  globalStatusToDbCodes,
  isMinePatient,
  isWaitingPatient,
  pendingActionLabel,
} from './dashboard-summary'

const patient = (id: string, code: string) => ({
  id,
  workflow_statuses: { id: `ws-${code}`, code, label: code },
})

describe('dashboard-summary', () => {
  it('compte les dossiers par statut global et les actions marcel', () => {
    const patients = [
      patient('1', 'draft'),
      patient('2', 'medical_review'),
      patient('3', 'case_closed'),
      patient('4', 'need_info'),
    ]

    const summary = computeDashboardSummary(patients, 'marcel')

    expect(summary.mine).toBe(2)
    expect(summary.waiting).toBe(1)
    expect(summary.closed).toBe(1)
    expect(summary.totalActive).toBe(3)
    expect(summary.byGlobalStatus.draft).toBe(1)
    expect(summary.byGlobalStatus.medical_review).toBe(1)
    expect(summary.byGlobalStatus.medical_more_info).toBe(1)
    expect(summary.byGlobalStatus.closed).toBe(1)
  })

  it('identifie les dossiers gilles en revue médicale comme "mine"', () => {
    const p = patient('g1', 'medical_review')
    expect(isMinePatient(p, 'gilles')).toBe(true)
    expect(isWaitingPatient(p, 'marcel')).toBe(true)
    expect(pendingActionLabel('medical_review', 'gilles')).toContain('Examinez')
  })

  it('filtre les ids focus mine', () => {
    const patients = [
      patient('1', 'draft'),
      patient('2', 'medical_review'),
      patient('3', 'case_closed'),
    ]

    const mineIds = getFocusPatientIds(patients, 'marcel', 'mine')

    expect(mineIds).toEqual(['1'])
    expect(getFocusPatientIds(patients, 'marcel', 'all')).toBeNull()
  })

  it('filtre pipeline brouillon avec prospect_created', () => {
    const patients = [
      patient('1', 'prospect_created'),
      patient('2', 'medical_review'),
      patient('3', 'draft'),
    ]

    const draftIds = getPipelinePatientIds(patients, 'draft')

    expect(draftIds).toEqual(['1', '3'])
    expect(globalStatusToDbCodes('draft')).toContain('prospect_created')
  })

  it('mappe les codes DB pour filtrage pipeline', () => {
    expect(globalStatusToDbCodes('draft')).toContain('draft')
    expect(globalStatusToDbCodes('closed')).toContain('case_closed')
  })
})
