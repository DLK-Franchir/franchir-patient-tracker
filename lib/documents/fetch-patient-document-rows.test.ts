import { describe, expect, it, vi } from 'vitest'
import { fetchPatientDocumentRows } from '@/lib/documents/fetch-patient-document-rows'

/**
 * Régression Armandine / sandbox imagerie : 4305 fichiers, 36 SUID.
 * PostgREST max_rows=1000 → un seul `.limit(6000)` ne renvoie que 1000 lignes
 * (≈13–14 séries ASC = lombaire + début scanner crâne), pas les IRM encéphale.
 */
describe('fetchPatientDocumentRows — Armandine-scale paging', () => {
  it('collecte plus de 1000 lignes pour exposer les ~36 séries', async () => {
    const mkPage = (offset: number, n: number) =>
      Array.from({ length: n }, (_, i) => ({
        id: `row-${offset + i}`,
        series_instance_uid: `suid-${Math.floor((offset + i) / 120)}`,
        created_at: new Date(Date.UTC(2026, 8, 24, 15, 0, offset + i)).toISOString(),
      }))

    const rangeMock = vi
      .fn()
      .mockResolvedValueOnce({ data: mkPage(0, 1000), error: null })
      .mockResolvedValueOnce({ data: mkPage(1000, 1000), error: null })
      .mockResolvedValueOnce({ data: mkPage(2000, 1000), error: null })
      .mockResolvedValueOnce({ data: mkPage(3000, 1000), error: null })
      .mockResolvedValueOnce({ data: mkPage(4000, 305), error: null })

    const orderMock = vi.fn(() => ({ range: rangeMock }))
    const eqMock = vi.fn(() => ({ order: orderMock }))
    const selectMock = vi.fn(() => ({ eq: eqMock }))

    const { rows, truncated } = await fetchPatientDocumentRows(
      { from: () => ({ select: selectMock }) } as never,
      'e7165a6d-4f1d-4111-a000-000000000001',
      { select: 'id, series_instance_uid, created_at' },
    )

    expect(rows).toHaveLength(4305)
    expect(truncated).toBe(false)
    const suids = new Set(rows.map((r) => r.series_instance_uid))
    expect(suids.size).toBeGreaterThanOrEqual(36)
    expect(rangeMock).toHaveBeenCalledTimes(5)
  })
})
