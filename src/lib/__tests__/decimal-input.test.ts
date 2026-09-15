import { describe, it, expect } from 'vitest'
import { normalizeDecimalInput, trimTrailingDot } from '../decimal-input'

describe('normalizeDecimalInput — comma-locale fix (root cause: native type="number" renders OS-locale glyphs)', () => {
  it('normalizes a comma-decimal value to period-decimal', () => {
    expect(normalizeDecimalInput('0,05')).toBe('0.05')
  })
  it('passes through an already period-decimal value unchanged', () => {
    expect(normalizeDecimalInput('0.05')).toBe('0.05')
  })
  it('allows an empty string (clearing the field)', () => {
    expect(normalizeDecimalInput('')).toBe('')
  })
  it('allows a bare integer while typing', () => {
    expect(normalizeDecimalInput('5')).toBe('5')
  })
  it('allows a trailing dot mid-typing ("5.")', () => {
    expect(normalizeDecimalInput('5.')).toBe('5.')
  })
})

describe('normalizeDecimalInput — rejects invalid keystrokes', () => {
  it('rejects letters', () => {
    expect(normalizeDecimalInput('abc')).toBeNull()
  })
  it('rejects a second decimal separator ("1.2.3")', () => {
    expect(normalizeDecimalInput('1.2.3')).toBeNull()
  })
  it('rejects a second separator introduced via comma normalization ("1,2,3")', () => {
    expect(normalizeDecimalInput('1,2,3')).toBeNull()
  })
  it('rejects mixed letters and digits', () => {
    expect(normalizeDecimalInput('12a')).toBeNull()
  })
})

describe('normalizeDecimalInput — clamps to max', () => {
  it('clamps a complete value above max down to max', () => {
    expect(normalizeDecimalInput('10', { max: '5' })).toBe('5')
  })
  it('does not clamp a value at or below max', () => {
    expect(normalizeDecimalInput('5', { max: '5' })).toBe('5')
    expect(normalizeDecimalInput('3', { max: '5' })).toBe('3')
  })
  it('does not clamp mid-typing a trailing dot (would corrupt "5." into "5")', () => {
    expect(normalizeDecimalInput('5.', { max: '5' })).toBe('5.')
  })
  it('ignores an unparseable max rather than throwing', () => {
    expect(normalizeDecimalInput('10', { max: 'not-a-number' })).toBe('10')
  })
})

describe('trimTrailingDot', () => {
  it('removes a trailing dot', () => {
    expect(trimTrailingDot('5.')).toBe('5')
  })
  it('leaves a value with no trailing dot unchanged', () => {
    expect(trimTrailingDot('5.05')).toBe('5.05')
  })
  it('leaves an empty string unchanged', () => {
    expect(trimTrailingDot('')).toBe('')
  })
})
