import {
  getDiversityWeight,
  calculateDiversityWeightedRatio,
  getDiversityDiagnostic,
  type StakerPosition,
} from '../diversity-weight'

// ─── getDiversityWeight ────────────────────────────────────────────────────

describe('getDiversityWeight', () => {
  it('returns 1.0 when staker holds ≤ 25%', () => {
    expect(getDiversityWeight(25n, 100n)).toBe(1.0)
    expect(getDiversityWeight(10n, 100n)).toBe(1.0)
    expect(getDiversityWeight(1n, 100n)).toBe(1.0)
  })

  it('returns 0.75 when staker holds > 25% and ≤ 50%', () => {
    expect(getDiversityWeight(26n, 100n)).toBe(0.75)
    expect(getDiversityWeight(50n, 100n)).toBe(0.75)
  })

  it('returns 0.5 when staker holds > 50%', () => {
    expect(getDiversityWeight(51n, 100n)).toBe(0.5)
    expect(getDiversityWeight(100n, 100n)).toBe(0.5)
  })

  it('returns 1.0 when total is 0 (no division by zero)', () => {
    expect(getDiversityWeight(0n, 0n)).toBe(1.0)
  })
})

// ─── calculateDiversityWeightedRatio ──────────────────────────────────────

const pos = (account_id: string, sharesEth: number): StakerPosition => ({
  account_id,
  shares: String(BigInt(Math.round(sharesEth * 1e18))),
})

describe('calculateDiversityWeightedRatio', () => {
  it('returns 50 when no positions on either side', () => {
    expect(calculateDiversityWeightedRatio([], [])).toBe(50)
  })

  it('returns 100 when only support positions exist', () => {
    expect(calculateDiversityWeightedRatio([pos('a', 10)], [])).toBe(100)
  })

  it('returns 0 when only oppose positions exist', () => {
    expect(calculateDiversityWeightedRatio([], [pos('b', 10)])).toBe(0)
  })

  it('returns 50 for equal support and oppose with single stakers each', () => {
    expect(calculateDiversityWeightedRatio([pos('a', 10)], [pos('b', 10)])).toBe(50)
  })

  it('dampens whale on support side', () => {
    // Whale holds 100% of support → 0.5x weight on 100 tTRUST
    // Oppose: 2 stakers × 10 tTRUST each → each 50% → 0.75x weight
    const support = [pos('whale', 100)]
    const oppose = [pos('b', 10), pos('c', 10)]

    const raw = calculateDiversityWeightedRatio(
      [pos('whale', 100)],
      [pos('b', 10), pos('c', 10)],
    )
    // weightedSupport = 100e18 * 0.5 = 50e18
    // weightedOppose = 10e18 * 0.75 + 10e18 * 0.75 = 15e18 (each is 50% of oppose total)
    // ratio = 50 / 65 ≈ 77
    expect(raw).toBe(77)
  })

  it('does NOT dampen when stakers are evenly spread', () => {
    // 4 stakers × 25 tTRUST each on support — each holds exactly 25% → weight 1.0
    // 1 staker × 100 tTRUST on oppose — holds 100% → weight 0.5
    const support = [pos('a', 25), pos('b', 25), pos('c', 25), pos('d', 25)]
    const oppose = [pos('whale', 100)]
    const ratio = calculateDiversityWeightedRatio(support, oppose)
    // weightedSupport = 100e18 * 1.0 = 100e18
    // weightedOppose  = 100e18 * 0.5 = 50e18
    // ratio = 100 / 150 ≈ 67
    expect(ratio).toBe(67)
  })

  it('handles invalid shares strings gracefully', () => {
    const bad: StakerPosition[] = [{ account_id: 'x', shares: 'not-a-number' }]
    expect(() => calculateDiversityWeightedRatio(bad, [])).not.toThrow()
    expect(calculateDiversityWeightedRatio(bad, [])).toBe(50)
  })
})

// ─── getDiversityDiagnostic ───────────────────────────────────────────────

describe('getDiversityDiagnostic', () => {
  it('detects whale when single staker holds > 25% of a side', () => {
    const d = getDiversityDiagnostic([pos('whale', 80), pos('b', 20)], [])
    expect(d.whaleDetected).toBe(true)
    expect(d.topSupportFraction).toBeCloseTo(0.8, 1)
  })

  it('does not flag whale when spread is even', () => {
    const support = [pos('a', 25), pos('b', 25), pos('c', 25), pos('d', 25)]
    const d = getDiversityDiagnostic(support, [])
    expect(d.whaleDetected).toBe(false)
    expect(d.topSupportFraction).toBeCloseTo(0.25, 2)
  })

  it('raw ratio matches simple proportion', () => {
    const d = getDiversityDiagnostic([pos('a', 75)], [pos('b', 25)])
    expect(d.rawRatio).toBe(75)
  })
})
