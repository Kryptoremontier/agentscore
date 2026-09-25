import { describe, it, expect } from 'vitest'
import {
  readSharesWei, hasMeasuredScore, scoreBasisOf, measuredScore, qualityBucket, supportPercent,
  type QualityBucket,
} from '../score-basis'
import { calculateTrustScoreFromStakes } from '../trust-score-engine'

/**
 * "A prior is not a measurement": the trust formula returns its neutral 50
 * anchor at zero stake. These tests pin which rows may print a number.
 * Stake values are the live /api/v1/agents numbers of 2026-09-24.
 */

const agg = (count: number, shares: string | null) => ({ aggregate: { count, sum: shares == null ? null : { shares } } })

describe('readSharesWei — never fetched is not zero', () => {
  it('absent aggregate (cohort row) → null', () => {
    expect(readSharesWei(undefined)).toBeNull()
    expect(readSharesWei(null)).toBeNull()
  })
  it('fetched with no shares → 0n', () => {
    expect(readSharesWei(agg(0, null))).toBe(0n)
    expect(readSharesWei(agg(1, '0'))).toBe(0n)
  })
  it('unparseable → null, never a silent 0', () => {
    expect(readSharesWei(agg(1, '1.5'))).toBeNull()
  })
  it('real value parses exactly', () => {
    expect(readSharesWei(agg(1, '980000000000000'))).toBe(980000000000000n)
  })
})

describe('hasMeasuredScore — gate on stake, not stakers', () => {
  it('0 stake with 1 staker (a zero-share position, e.g. Agent Avatar Coder) → not measured', () => {
    expect(hasMeasuredScore({ supportWei: readSharesWei(agg(1, '0')), opposeWei: 0n })).toBe(false)
  })
  it('0.001 tTRUST (Luda, 980000000000000 wei) → measured', () => {
    expect(hasMeasuredScore({ supportWei: 980_000_000_000_000n })).toBe(true)
  })
  it('never-fetched support (cohort) → not measured, even if some oppose is known', () => {
    expect(hasMeasuredScore({ supportWei: null })).toBe(false)
    expect(hasMeasuredScore({ supportWei: null, opposeWei: 5n })).toBe(false)
  })
  it('oppose-only stake is a measurement (the score then reads below 50)', () => {
    expect(hasMeasuredScore({ supportWei: 0n, opposeWei: 1n })).toBe(true)
  })
  it('loading (no reading at all) → not measured', () => {
    expect(hasMeasuredScore(null)).toBe(false)
    expect(hasMeasuredScore(undefined)).toBe(false)
  })
  it('scoreBasisOf mirrors it', () => {
    expect(scoreBasisOf({ supportWei: 0n, opposeWei: 0n })).toBe('prior')
    expect(scoreBasisOf({ supportWei: 335_061_000_000_000_000n })).toBe('measured')
  })
})

describe('measuredScore — what the UI prints', () => {
  it('0-stake / 1-staker row → null (rendered "—"), although the formula says 50', () => {
    const t = calculateTrustScoreFromStakes(0n, 0n)
    expect(t.score).toBe(50) // the prior is still there — it's just not printed
    expect(measuredScore(t, hasMeasuredScore({ supportWei: 0n }))).toBeNull()
  })
  it('0.001-stake row → numeric (Luda: computed, 99% prior-weighted, but measured)', () => {
    const t = calculateTrustScoreFromStakes(980_000_000_000_000n, 0n)
    expect(measuredScore(t, hasMeasuredScore({ supportWei: 980_000_000_000_000n }))).toBe(50)
  })
  it('loading (no result yet) → null', () => {
    expect(measuredScore(null, false)).toBeNull()
    expect(measuredScore(undefined, true)).toBeNull()
  })
  it('OPEN CLAW (0.335061 tTRUST) → 98', () => {
    const w = 335_061_000_000_000_000n
    expect(measuredScore(calculateTrustScoreFromStakes(w, 0n), hasMeasuredScore({ supportWei: w }))).toBe(98)
  })
})

describe('supportPercent — no 100% of nothing', () => {
  it('null at zero stake', () => {
    expect(supportPercent({ supportWei: 0n, opposeWei: 0n })).toBeNull()
    expect(supportPercent({ supportWei: null })).toBeNull()
  })
  it('real split when staked', () => {
    expect(supportPercent({ supportWei: 3n, opposeWei: 1n })).toBe(75)
    expect(supportPercent({ supportWei: 5n })).toBe(100)
  })
})

describe('qualityBucket — unmeasured rows are Unrated, never Moderate', () => {
  // The 9 live AgentScore rows (2026-09-24) + the ERC-8004 cohort (264, never fetched).
  const LIVE: Array<[string, string, number]> = [
    ['OPEN CLAW', '335061000000000000', 1],
    ['Code Helper AI', '224900000000000000', 3],
    ['AGI Tracker', '117600000000000000', 1],
    ['AgentScore Sorting Agent', '99960000000000000', 2],
    ['CodeBuddy', '98980000000000000', 2],
    ['Talaria', '49980000000000000', 1],
    ['Luda', '980000000000000', 1],
    ['On-Chain Data Analyzer', '0', 1],
    ['Agent Avatar Coder', '0', 1],
  ]
  const COHORT_SIZE = 264

  function bucketCounts() {
    const counts: Record<QualityBucket, number> = { excellent: 0, good: 0, moderate: 0, low: 0, critical: 0, unrated: 0 }
    for (const [, shares, count] of LIVE) {
      const supportWei = readSharesWei(agg(count, shares))
      const measured = hasMeasuredScore({ supportWei })
      counts[qualityBucket(calculateTrustScoreFromStakes(supportWei ?? 0n, 0n), measured)]++
    }
    for (let i = 0; i < COHORT_SIZE; i++) {
      const supportWei = readSharesWei(undefined) // cohort rows carry no positions_aggregate
      counts[qualityBucket(calculateTrustScoreFromStakes(supportWei ?? 0n, 0n), hasMeasuredScore({ supportWei }))]++
    }
    return counts
  }

  it('today: Excellent 2 · Good 4 · Moderate 1 · Low 0 · Critical 0 · Unrated 266', () => {
    expect(bucketCounts()).toEqual({ excellent: 2, good: 4, moderate: 1, low: 0, critical: 0, unrated: 266 })
  })

  it('Moderate holds only measured rows — the 3 former "50"s split into 1 measured (Luda) + 2 Unrated', () => {
    const t = calculateTrustScoreFromStakes(0n, 0n)
    expect(t.level).toBe('moderate') // what the old filter used
    expect(qualityBucket(t, false)).toBe('unrated')
  })
})
