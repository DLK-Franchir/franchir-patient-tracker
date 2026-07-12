import { describe, expect, it } from 'vitest'
import {
  computeDashboardSummary,
  formatMineBreakdown,
  getFocusPatientIds,
  getPipelinePatientIds,
  getPriorityBannerContent,
  globalStatusToDbCodes,
  isMinePatient,
  isWaitingPatient,
  mineActionShortLabel,
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
    expect(summary.mineBreakdown).toEqual([
      { globalStatus: 'draft', count: 1 },
      { globalStatus: 'medical_more_info', count: 1 },
    ])
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

  it('ventile mineBreakdown pour admin avec plusieurs types d\'action', () => {
    const patients = [
      ...Array.from({ length: 8 }, (_, i) => patient(`c${i}`, 'validated_medical')),
      ...Array.from({ length: 3 }, (_, i) => patient(`d${i}`, 'draft')),
      ...Array.from({ length: 5 }, (_, i) => patient(`s${i}`, 'surgery_scheduled')),
    ]

    const summary = computeDashboardSummary(patients, 'admin')

    expect(summary.mine).toBe(11)
    expect(summary.totalActive).toBe(16)
    expect(summary.mineBreakdown).toEqual([
      { globalStatus: 'commercial_in_progress', count: 8 },
      { globalStatus: 'draft', count: 3 },
    ])
    expect(formatMineBreakdown(summary.mineBreakdown, 'admin')).toBe(
      '8 devis à confirmer · 3 à soumettre',
    )
  })

  it('bandeau : total actif + ventilation mine (pas guidance unique sur tout le total)', () => {
    const patients = [
      ...Array.from({ length: 8 }, (_, i) => patient(`c${i}`, 'commercial')),
      ...Array.from({ length: 3 }, (_, i) => patient(`d${i}`, 'draft')),
      ...Array.from({ length: 5 }, (_, i) => patient(`s${i}`, 'surgery_scheduled')),
    ]

    const summary = computeDashboardSummary(patients, 'admin')
    const banner = getPriorityBannerContent(summary, 'admin')

    expect(banner).not.toBeNull()
    expect(banner?.title).toBe('16 dossiers actifs')
    expect(banner?.subtitle).toContain('11 dossiers vous attendent')
    expect(banner?.subtitle).toContain('8 devis à confirmer')
    expect(banner?.subtitle).toContain('3 à soumettre')
    expect(banner?.subtitle).not.toContain('Confirmez le devis et la date proposée pour finaliser le dossier.')
    expect(banner?.variant).toBe('action')
    expect(banner?.globalStatus).toBe('commercial_in_progress')
  })

  it('bandeau neutre quand mine === 0 (même avec dossiers commerciaux en attente)', () => {
    const patients = Array.from({ length: 14 }, (_, i) => patient(`c${i}`, 'validated_medical'))

    const summary = computeDashboardSummary(patients, 'gilles')

    expect(summary.mine).toBe(0)
    expect(summary.waiting).toBe(14)

    const banner = getPriorityBannerContent(summary, 'gilles')

    expect(banner?.title).toBe('14 dossiers actifs')
    expect(banner?.subtitle).toContain('Aucune action requise de votre part')
    expect(banner?.subtitle).toContain('14 dossiers en cours chez d\'autres intervenants')
    expect(banner?.variant).toBe('neutral')
    expect(banner?.subtitle).not.toContain('Confirmez le devis')
  })

  it('bandeau : guidance unique quand un seul type d\'action mine', () => {
    const patients = Array.from({ length: 3 }, (_, i) => patient(`d${i}`, 'draft'))
    const summary = computeDashboardSummary(patients, 'marcel')
    const banner = getPriorityBannerContent(summary, 'marcel')

    expect(banner?.subtitle).toContain('3 dossiers vous attendent')
    expect(banner?.subtitle).toContain('Soumettez ce dossier à la validation médicale')
    expect(mineActionShortLabel('draft', 'marcel')).toBe('à soumettre')
  })
})
