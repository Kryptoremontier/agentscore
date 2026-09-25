import { describe, it, expect } from 'vitest'
import { calculateTier } from '../trust-tiers'
import { measuredTier } from '../score-basis'

/**
 * List cards used calculateTier(stakers, stake, 50, age): a hardcoded 50
 * trust ratio. Trusted needs ≥60 and Verified ≥75, so no card could ever show
 * either. measuredTier passes the real support ratio (the API's trustTier
 * inputs) and returns null — no chip — when there is no stake to take a ratio of.
 */

const T = (tTrust: number) => BigInt(Math.round(tTrust * 1e6)) * 10n ** 12n

describe('calculateTier at zero stake — the ratio is never consulted', () => {
  it('returns Unverified for every ratio 0..100 (and NaN): each higher tier needs minTotalStake > 0', () => {
    for (let ratio = 0; ratio <= 100; ratio++) {
      expect(calculateTier(50, 0, ratio, 400).tier).toBe('unverified')
    }
    expect(calculateTier(50, 0, Number.NaN, 400).tier).toBe('unverified')
  })
})

describe('measuredTier', () => {
  it('no stake → null (no chip), never a tier computed from an invented ratio', () => {
    expect(measuredTier({ stakers: 1, supportWei: 0n, opposeWei: 0n, ageDays: 214 })).toBeNull()
    expect(measuredTier({ stakers: 0, supportWei: null, ageDays: 30 })).toBeNull() // cohort: never read
  })

  it('Code Helper AI (3 stakers, 0.2249 tTRUST, 200 days) → Sandbox, same as before', () => {
    expect(measuredTier({ stakers: 3, supportWei: T(0.2249), ageDays: 200 })?.tier).toBe('sandbox')
  })

  it('the old literal 50 capped a Trusted-eligible agent at Sandbox; the real ratio does not', () => {
    const [stakers, stake, age] = [10, 1.0, 7]
    expect(calculateTier(stakers, stake, 50, age).tier).toBe('sandbox') // before
    expect(measuredTier({ stakers, supportWei: T(stake), ageDays: age })?.tier).toBe('trusted') // after (100% support)
  })

  it('the ratio still gates Trusted: 59% support stays Sandbox, 60% is Trusted', () => {
    const base = { stakers: 10, ageDays: 7 }
    expect(measuredTier({ ...base, supportWei: T(0.59), opposeWei: T(0.41) })?.tier).toBe('sandbox')
    expect(measuredTier({ ...base, supportWei: T(0.6), opposeWei: T(0.4) })?.tier).toBe('trusted')
  })

  it('oppose stake counts toward total stake, as in the API', () => {
    // 0.6 support + 0.4 oppose = 1.0 total → meets Trusted's stake floor
    expect(measuredTier({ stakers: 10, supportWei: T(0.6), opposeWei: T(0.4), ageDays: 7 })?.tier).toBe('trusted')
  })

  // Live /api/v1/agents 2026-09-24 (stakers, stake tTRUST, age in days on 2026-09-25).
  const LIVE: Array<[string, number, number, number]> = [
    ['OPEN CLAW', 1, 0.335061, 219],
    ['Code Helper AI', 3, 0.2249, 200],
    ['AGI Tracker', 1, 0.1176, 188],
    ['AgentScore Sorting Agent', 2, 0.09996, 145],
    ['CodeBuddy', 2, 0.09898, 174],
    ['Talaria', 1, 0.04998, 155],
    ['Luda', 1, 0.00098, 116],
    ['On-Chain Data Analyzer', 1, 0, 205],
    ['Agent Avatar Coder', 1, 0, 214],
  ]

  it('live rows: no measured chip changes today; the two zero-stake rows lose an invented chip', () => {
    const changes = LIVE.map(([name, stakers, stake, age]) => {
      const before = calculateTier(stakers, stake, 50, age).tier
      const after = measuredTier({ stakers, supportWei: T(stake), ageDays: age })?.tier ?? null
      return { name, before, after }
    })
    expect(changes.filter(c => c.after !== null && c.after !== c.before)).toEqual([])
    expect(changes.filter(c => c.after === null).map(c => c.name)).toEqual(['On-Chain Data Analyzer', 'Agent Avatar Coder'])
    expect(changes.find(c => c.name === 'Code Helper AI')).toEqual({ name: 'Code Helper AI', before: 'sandbox', after: 'sandbox' })
  })
})
