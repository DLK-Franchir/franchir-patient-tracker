import { describe, expect, it } from 'vitest'
import { parseMessageTopic } from './message-topic'

describe('parseMessageTopic', () => {
  it('accepte commercial', () => {
    expect(parseMessageTopic('commercial')).toBe('commercial')
  })

  it('accepte medical', () => {
    expect(parseMessageTopic('medical')).toBe('medical')
  })

  it('retombe sur medical pour une valeur absente ou inconnue', () => {
    expect(parseMessageTopic(undefined)).toBe('medical')
    expect(parseMessageTopic(null)).toBe('medical')
    expect(parseMessageTopic('')).toBe('medical')
    expect(parseMessageTopic('Commercial')).toBe('medical')
    expect(parseMessageTopic(42)).toBe('medical')
  })

  it('refuse les sujets réservés aux événements applicatifs', () => {
    expect(parseMessageTopic('system')).toBe('medical')
    expect(parseMessageTopic('audit')).toBe('medical')
  })
})
