import { describe, expect, it } from 'vitest'
import {
  nextPoolLoadIndex,
  POOL_BOOTSTRAP_INDEX,
  shouldPumpParallelLoads,
} from './pool-plan'

describe('pool-plan', () => {
  it('charge index 0 seul tant que le bootstrap nest pas termine', () => {
    expect(shouldPumpParallelLoads(false, 825)).toBe(false)
    expect(nextPoolLoadIndex(0, 825, false)).toBe(POOL_BOOTSTRAP_INDEX)
    expect(nextPoolLoadIndex(1, 825, false)).toBeNull()
  })

  it('enchaîne les indices apres bootstrap', () => {
    const poolSize = 50
    expect(shouldPumpParallelLoads(true, poolSize)).toBe(true)
    expect(nextPoolLoadIndex(1, poolSize, true)).toBe(1)
    expect(nextPoolLoadIndex(50, poolSize, true)).toBeNull()
  })

  it('serie a un seul fichier sans phase bootstrap', () => {
    expect(shouldPumpParallelLoads(false, 1)).toBe(true)
    expect(nextPoolLoadIndex(0, 1, false)).toBe(0)
  })
})
