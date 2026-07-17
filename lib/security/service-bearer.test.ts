import { describe, expect, it } from 'vitest'
import { isValidBearer } from './service-bearer'

describe('isValidBearer', () => {
  it('accepts a matching bearer token', () => {
    expect(isValidBearer('Bearer secret-token', 'secret-token')).toBe(true)
  })

  it('accepts any of several expected tokens', () => {
    expect(isValidBearer('Bearer b', 'a', 'b')).toBe(true)
  })

  it('rejects wrong scheme, missing token, or mismatch', () => {
    expect(isValidBearer('Basic secret-token', 'secret-token')).toBe(false)
    expect(isValidBearer('Bearer ', 'secret-token')).toBe(false)
    expect(isValidBearer('Bearer wrong', 'secret-token')).toBe(false)
    expect(isValidBearer(null, 'secret-token')).toBe(false)
    expect(isValidBearer('Bearer secret-token')).toBe(false)
  })
})
