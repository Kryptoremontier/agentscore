import { describe, it, expect } from 'vitest'
import { formatTTrust, formatDate, formatDateShort } from '../format'

describe('formatTTrust — never a "$" prefix', () => {
  it('formats zero', () => {
    expect(formatTTrust(0n)).toBe('0.0000 tTRUST')
  })
  it('formats dust wei (1e15 = 0.001)', () => {
    expect(formatTTrust(1_000_000_000_000_000n)).toBe('0.0010 tTRUST')
  })
  it('formats a whole-number-ish amount with 2 decimals above 1', () => {
    expect(formatTTrust(1_500_000_000_000_000_000n)).toBe('1.50 tTRUST')
  })
  it('abbreviates thousands as K', () => {
    expect(formatTTrust(1_500_000_000_000_000_000_000n)).toBe('1.5K tTRUST')
  })
  it('abbreviates millions as M', () => {
    expect(formatTTrust(2_300_000_000_000_000_000_000_000n)).toBe('2.3M tTRUST')
  })
  it('accepts a numeric string (wei)', () => {
    expect(formatTTrust('980000000000000')).toBe('0.0010 tTRUST')
  })
  it('accepts bigint input', () => {
    expect(formatTTrust(980000000000000n)).toBe('0.0010 tTRUST')
  })
  it('accepts an already-ether-denominated number via fromEther', () => {
    expect(formatTTrust(0.2249, { fromEther: true })).toBe('0.2249 tTRUST')
  })
  it('never contains a dollar sign', () => {
    const samples = [0n, 1n, 1_000_000_000_000_000_000n, 1_000_000_000_000_000_000_000n, 1_000_000_000_000_000_000_000_000n]
    for (const s of samples) expect(formatTTrust(s)).not.toContain('$')
  })
  it('malformed input degrades to 0, never throws', () => {
    expect(() => formatTTrust('not-a-number')).not.toThrow()
    expect(formatTTrust('not-a-number')).toBe('0.0000 tTRUST')
  })
})

describe('formatDate', () => {
  it('formats an ISO string, short style, en-US month order', () => {
    expect(formatDate('2026-07-08T00:00:00Z', 'short')).toBe('Jul 8, 2026')
  })
  it('formats epoch milliseconds', () => {
    const ms = new Date('2026-01-01T00:00:00Z').getTime()
    expect(formatDate(ms)).toBe('Jan 1, 2026')
  })
  it('formats long style with 24h time', () => {
    const long = formatDate('2026-07-08T14:32:00Z', 'long')
    expect(long).toContain('July 8, 2026')
    expect(long).toMatch(/14:32/)
  })
  it('invalid input returns an em dash, never "Invalid Date"', () => {
    expect(formatDate('not-a-date')).toBe('—')
    expect(formatDate('not-a-date')).not.toContain('Invalid')
  })
  it('accepts a Date instance directly', () => {
    expect(formatDate(new Date('2026-03-01T00:00:00Z'))).toBe('Mar 1, 2026')
  })
})

describe('formatDateShort', () => {
  it('formats month + day only, no year', () => {
    expect(formatDateShort('2026-09-08T00:00:00Z')).toBe('Sep 8')
  })
  it('includes time when requested', () => {
    expect(formatDateShort('2026-09-08T14:32:00Z', { withTime: true })).toMatch(/Sep 8, 14:32/)
  })
  it('invalid input returns an em dash', () => {
    expect(formatDateShort('nope')).toBe('—')
  })
})
