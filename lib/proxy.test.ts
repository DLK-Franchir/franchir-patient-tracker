import { describe, expect, it } from 'vitest'
import { config } from '../proxy'

describe('proxy matcher', () => {
  it('laisse passer les workers dwv sans session', () => {
    const matcher = config.matcher[0]!
    const re = new RegExp(matcher)

    expect(re.test('/dwv-workers/jpegloss.worker.min.js')).toBe(false)
    expect(re.test('/assets/workers/jpegloss.worker.min.js')).toBe(false)
    expect(re.test('/dashboard')).toBe(true)
  })
})
