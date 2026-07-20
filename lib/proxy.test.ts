import { describe, expect, it } from 'vitest'
import { DWV_NEXT_WORKER_MATCHER, dwvWorkerRewriteTarget } from '@/lib/imaging/dwv-worker-rewrite'
import { config } from '../proxy'

describe('proxy matcher', () => {
  it('laisse passer les workers dwv et OpenJPEG sans session', () => {
    const matcher = config.matcher[0]!
    const re = new RegExp(matcher)

    expect(re.test('/dwv-workers/jpegloss.worker.min.js')).toBe(false)
    expect(re.test('/assets/workers/jpegloss.worker.min.js')).toBe(false)
    expect(re.test('/openjpeg/openjpegjs.js')).toBe(false)
    expect(re.test('/dashboard')).toBe(true)
  })

  it('declare un matcher additionnel pour les workers sous /_next', () => {
    // Source path-to-regexp Next (pas une RegExp JS brute) : on vérifie que la
    // règle ciblant les workers sous /_next est bien déclarée. Le routage runtime
    // est validé séparément (rewrite → /dwv-workers/*).
    expect(config.matcher).toContain(DWV_NEXT_WORKER_MATCHER)
  })
})

describe('dwvWorkerRewriteTarget (via adapter)', () => {
  it('réécrit le chemin worker runtime dwv (sous /_next) vers public', () => {
    expect(
      dwvWorkerRewriteTarget('/_next/static/chunks/assets/workers/jpeg2000.worker.min.js'),
    ).toBe('/dwv-workers/jpeg2000.worker.min.js')
  })

  it('réécrit le chemin worker bare /assets/workers', () => {
    expect(dwvWorkerRewriteTarget('/assets/workers/rle.worker.min.js')).toBe(
      '/dwv-workers/rle.worker.min.js',
    )
  })

  it('ignore les chemins non-worker', () => {
    expect(dwvWorkerRewriteTarget('/dashboard')).toBeNull()
    expect(dwvWorkerRewriteTarget('/_next/static/chunks/main.js')).toBeNull()
  })
})
