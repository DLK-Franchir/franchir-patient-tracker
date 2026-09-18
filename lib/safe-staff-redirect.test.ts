import { describe, expect, it } from 'vitest'
import { safeStaffRedirectPath } from './safe-staff-redirect'

describe('safeStaffRedirectPath', () => {
  it('garde les chemins internes utiles', () => {
    expect(safeStaffRedirectPath('/imagerie')).toBe('/imagerie')
    expect(safeStaffRedirectPath('/dashboard/patient/abc')).toBe('/dashboard/patient/abc')
  })

  it('refuse les redirections externes ou le login', () => {
    expect(safeStaffRedirectPath('https://example.com')).toBe('/dashboard')
    expect(safeStaffRedirectPath('//evil.example')).toBe('/dashboard')
    expect(safeStaffRedirectPath('/login')).toBe('/dashboard')
    expect(safeStaffRedirectPath(null)).toBe('/dashboard')
  })
})
