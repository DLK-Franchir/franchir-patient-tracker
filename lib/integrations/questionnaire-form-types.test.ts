import { describe, expect, it } from 'vitest'
import {
  formTypesEqual,
  formTypesForPreset,
  normalizeFormTypes,
  parseFormTypesInput,
  coercePatientFormTypes,
} from './questionnaire-form-types'

describe('questionnaire-form-types', () => {
  it('normalizes order cervical then lombaire', () => {
    expect(normalizeFormTypes(['lombaire', 'cervical'])).toEqual(['cervical', 'lombaire'])
  })

  it('compares form type sets', () => {
    expect(formTypesEqual(['cervical'], ['cervical'])).toBe(true)
    expect(formTypesEqual(['lombaire', 'cervical'], ['cervical', 'lombaire'])).toBe(true)
    expect(formTypesEqual(['cervical'], ['lombaire'])).toBe(false)
  })

  it('parses API input', () => {
    expect(parseFormTypesInput(['lombaire'])).toEqual(['lombaire'])
    expect(parseFormTypesInput(['invalid'])).toBeNull()
    expect(parseFormTypesInput(['cervical', 'invalid'])).toBeNull()
  })

  it('coerces DB values with unknown entries filtered', () => {
    expect(coercePatientFormTypes(['lombaire', 'unknown'])).toEqual(['lombaire'])
    expect(coercePatientFormTypes(null)).toEqual(['cervical'])
  })

  it('builds combined preset', () => {
    expect(formTypesForPreset('combined')).toEqual(['cervical', 'lombaire'])
  })
})
