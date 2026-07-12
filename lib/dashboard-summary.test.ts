import { describe, expect, it } from 'vitest'
import {
  computeDashboardSummary,
  getFocusPatientIds,
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

  it('filtre les ids focus mine et waiting', () => {
    const patients = [
      patient('1', 'draft'),
      patient('2', 'medical_review'),
      patient('3', 'case_closed'),
    ]

    const mineIds = getFocusPatientIds(patients, 'marcel', 'mine')
    const waitingIds = getFocusPatientIds(patients, 'marcel', 'waiting')

    expect(mineIds).toEqual(['1'])
    expect(waitingIds).toEqual(['2'])
    expect(getFocusPatientIds(patients, 'marcel', 'all')).toBeNull()
  })

  it('mappe les codes DB pour filtrage pipeline', () => {
    expect(globalStatusToDbCodes('draft')).toContain('draft')
    expect(globalStatusToDbCodes('closed')).toContain('case_closed')
  })
})
