import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { qualityCacheSet, qualityCacheGet, qualityCacheClear, qualityCacheSize } from '../quality-cache'

beforeEach(() => {
  vi.useFakeTimers()
  qualityCacheClear()
})
afterEach(() => { vi.useRealTimers() })

describe('qualityCache', () => {
  it('stores and retrieves a qualityScore by termId', () => {
    qualityCacheSet('0xabc', 58.3)
    expect(qualityCacheGet('0xabc')).toBe(58.3)
  })

  it('returns null for unknown termId', () => {
    expect(qualityCacheGet('0xunknown')).toBeNull()
  })

  it('expires entries after 5 minutes', () => {
    qualityCacheSet('0xabc', 58.3)
    vi.advanceTimersByTime(5 * 60_000 + 1)
    expect(qualityCacheGet('0xabc')).toBeNull()
  })

  it('does not expire before TTL', () => {
    qualityCacheSet('0xabc', 58.3)
    vi.advanceTimersByTime(5 * 60_000 - 1)
    expect(qualityCacheGet('0xabc')).toBe(58.3)
  })

  it('overwrites an existing entry with the same key', () => {
    qualityCacheSet('0xabc', 50)
    qualityCacheSet('0xabc', 72.1)
    expect(qualityCacheGet('0xabc')).toBe(72.1)
  })

  it('evicts the oldest entry when MAX_ENTRIES (500) is exceeded', () => {
    // fill to capacity
    for (let i = 0; i < 500; i++) {
      qualityCacheSet(`0x${i.toString(16).padStart(4, '0')}`, i)
    }
    expect(qualityCacheSize()).toBe(500)
    // oldest key is 0x0000
    expect(qualityCacheGet('0x0000')).toBe(0)

    // adding one more should evict 0x0000
    qualityCacheSet('0x9999', 99)
    expect(qualityCacheSize()).toBe(500) // still 500
    expect(qualityCacheGet('0x0000')).toBeNull() // evicted
    expect(qualityCacheGet('0x9999')).toBe(99)  // present
  })

  it('re-insert moves entry to newest position (LRU)', () => {
    for (let i = 0; i < 500; i++) {
      qualityCacheSet(`0x${i.toString(16).padStart(4, '0')}`, i)
    }
    // access 0x0000 to make it newest
    qualityCacheSet('0x0000', 42)

    // overflow: 0x0001 should be evicted (now oldest), not 0x0000
    qualityCacheSet('0x9999', 99)
    expect(qualityCacheGet('0x0000')).toBe(42)  // survived
    expect(qualityCacheGet('0x0001')).toBeNull() // evicted
  })
})
