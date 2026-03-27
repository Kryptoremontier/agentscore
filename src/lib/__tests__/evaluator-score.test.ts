import { describe, it, expect } from 'vitest'
import { calculateEvaluatorScore, type StakerPosition } from '../evaluator-score'
import { calculateDiversityWeightedRatio, type StakerPosition as DivStakerPosition } from '../diversity-weight'

// ─── calculateEvaluatorScore ──────────────────────────────────────────────────

function makePos(overrides: Partial<StakerPosition> & { agentAtomId: string }): StakerPosition {
  return {
    agentName: `Agent ${overrides.agentAtomId}`,
    side: 'support',
    currentTrustScore: 75,
    isCreator: false,
    ...overrides,
  }
}

describe('calculateEvaluatorScore', () => {
  it('newcomer with no positions', () => {
    const result = calculateEvaluatorScore('0x123', [])
    expect(result.evaluatorTier).toBe('newcomer')
    expect(result.evaluatorWeight).toBe(1.0)
    expect(result.adjustedAccuracy).toBe(0.5)
    expect(result.totalPositions).toBe(0)
    expect(result.goodPicks).toBe(0)
    expect(result.streakCount).toBe(0)
    expect(result.bestPick).toBeNull()
    expect(result.worstPick).toBeNull()
  })

  it('perfect accuracy — all support on high-trust agents', () => {
    const positions: StakerPosition[] = Array.from({ length: 10 }, (_, i) =>
      makePos({ agentAtomId: `a${i}`, currentTrustScore: 70 + i })
    )

    const result = calculateEvaluatorScore('0x123', positions)
    expect(result.rawAccuracy).toBe(1.0)
    expect(result.evaluatorWeight).toBeGreaterThan(1.3)
    expect(result.evaluatorTier).toBe('oracle') // 10+ positions, accuracy > 75%
    expect(result.goodPicks).toBe(10)
  })

  it('terrible accuracy — support on low-trust agents', () => {
    const positions: StakerPosition[] = Array.from({ length: 10 }, (_, i) =>
      makePos({ agentAtomId: `a${i}`, currentTrustScore: 20 + i })
    )

    const result = calculateEvaluatorScore('0x123', positions)
    expect(result.rawAccuracy).toBe(0)
    expect(result.evaluatorWeight).toBeLessThan(0.7)
    expect(result.goodPicks).toBe(0)
  })

  it('excludes self-created agents from track record', () => {
    const positions: StakerPosition[] = [
      makePos({ agentAtomId: 'own1', currentTrustScore: 90, isCreator: true }),
      makePos({ agentAtomId: 'other1', currentTrustScore: 30, isCreator: false }),
    ]

    const result = calculateEvaluatorScore('0x123', positions)
    expect(result.totalPositions).toBe(1)   // only OtherAgent counted
    expect(result.goodPicks).toBe(0)         // trust 30 < 50 → bad support pick
  })

  it('oppose on low-trust agent = correct pick', () => {
    const positions: StakerPosition[] = [
      makePos({ agentAtomId: 'bad1', agentName: 'BadAgent', side: 'oppose', currentTrustScore: 25 }),
    ]

    const result = calculateEvaluatorScore('0x123', positions)
    expect(result.goodPicks).toBe(1)
  })

  it('oppose on high-trust agent = incorrect pick', () => {
    const positions: StakerPosition[] = [
      makePos({ agentAtomId: 'good1', side: 'oppose', currentTrustScore: 80 }),
    ]

    const result = calculateEvaluatorScore('0x123', positions)
    expect(result.goodPicks).toBe(0)
  })

  it('confidence scales with position count', () => {
    const onePosition = calculateEvaluatorScore('0x1', [
      makePos({ agentAtomId: 'a1', currentTrustScore: 90 }),
    ])

    const tenPositions = calculateEvaluatorScore('0x2',
      Array.from({ length: 10 }, (_, i) =>
        makePos({ agentAtomId: `a${i}`, currentTrustScore: 90 })
      )
    )

    // Both have 100% raw accuracy but different confidence
    expect(onePosition.confidence).toBeLessThan(0.3)
    expect(tenPositions.confidence).toBeGreaterThan(0.85)

    // Ten positions should have higher adjusted accuracy
    expect(tenPositions.adjustedAccuracy).toBeGreaterThan(onePosition.adjustedAccuracy)
    expect(tenPositions.evaluatorWeight).toBeGreaterThan(onePosition.evaluatorWeight)
  })

  it('evaluatorWeight is between 0.5 and 1.5', () => {
    const worst = calculateEvaluatorScore('0x1',
      Array.from({ length: 20 }, (_, i) =>
        makePos({ agentAtomId: `a${i}`, currentTrustScore: 20 })
      )
    )
    const best = calculateEvaluatorScore('0x2',
      Array.from({ length: 20 }, (_, i) =>
        makePos({ agentAtomId: `a${i}`, currentTrustScore: 90 })
      )
    )

    expect(worst.evaluatorWeight).toBeGreaterThanOrEqual(0.5)
    expect(worst.evaluatorWeight).toBeLessThanOrEqual(1.0)
    expect(best.evaluatorWeight).toBeGreaterThanOrEqual(1.0)
    expect(best.evaluatorWeight).toBeLessThanOrEqual(1.5)
  })

  it('tier progression', () => {
    const makePositions = (count: number, accuracy: number): StakerPosition[] => {
      const good = Math.floor(count * accuracy)
      return Array.from({ length: count }, (_, i) =>
        makePos({ agentAtomId: `a${i}`, currentTrustScore: i < good ? 70 : 30 })
      )
    }

    expect(calculateEvaluatorScore('0x1', makePositions(2, 1.0)).evaluatorTier).toBe('newcomer')
    expect(calculateEvaluatorScore('0x2', makePositions(3, 0.4)).evaluatorTier).toBe('scout')
    expect(calculateEvaluatorScore('0x3', makePositions(5, 0.8)).evaluatorTier).toBe('analyst')
    expect(calculateEvaluatorScore('0x4', makePositions(10, 0.8)).evaluatorTier).toBe('oracle')
    expect(calculateEvaluatorScore('0x5', makePositions(20, 0.9)).evaluatorTier).toBe('sage')
  })

  it('streak counts consecutive good picks from most recent', () => {
    const positions: StakerPosition[] = [
      makePos({ agentAtomId: 'a1', currentTrustScore: 30 }),  // bad — breaks streak
      makePos({ agentAtomId: 'a2', currentTrustScore: 70 }),  // good
      makePos({ agentAtomId: 'a3', currentTrustScore: 30 }),  // bad — breaks streak
      makePos({ agentAtomId: 'a4', currentTrustScore: 75 }),  // good
      makePos({ agentAtomId: 'a5', currentTrustScore: 60 }),  // good
      makePos({ agentAtomId: 'a6', currentTrustScore: 80 }),  // good ← most recent
    ]

    const result = calculateEvaluatorScore('0x123', positions)
    expect(result.streakCount).toBe(3) // a6, a5, a4 are all good; a3 breaks it
  })

  it('bestPick and worstPick reference correct agents', () => {
    const positions: StakerPosition[] = [
      makePos({ agentAtomId: 'a1', agentName: 'BestAgent',  currentTrustScore: 92 }),
      makePos({ agentAtomId: 'a2', agentName: 'MidAgent',   currentTrustScore: 60 }),
      makePos({ agentAtomId: 'a3', agentName: 'WorstAgent', currentTrustScore: 15 }),
    ]

    const result = calculateEvaluatorScore('0x123', positions)
    expect(result.bestPick).toBe('BestAgent')
    expect(result.worstPick).toBe('WorstAgent')
  })

  it('neutral staker with 50% accuracy has weight = ~1.0', () => {
    const positions: StakerPosition[] = [
      makePos({ agentAtomId: 'a1', currentTrustScore: 80 }), // good
      makePos({ agentAtomId: 'a2', currentTrustScore: 20 }), // bad
      makePos({ agentAtomId: 'a3', currentTrustScore: 70 }), // good
      makePos({ agentAtomId: 'a4', currentTrustScore: 30 }), // bad
      makePos({ agentAtomId: 'a5', currentTrustScore: 75 }), // good
      makePos({ agentAtomId: 'a6', currentTrustScore: 25 }), // bad
    ]

    const result = calculateEvaluatorScore('0x123', positions)
    expect(result.rawAccuracy).toBe(0.5)
    // adjustedAccuracy pulled toward 0.5 — weight should be close to 1.0
    expect(result.evaluatorWeight).toBeCloseTo(1.0, 1)
  })
})

// ─── diversity-weight integration with evaluatorWeights ───────────────────────

const divPos = (account_id: string, sharesEth: number): DivStakerPosition => ({
  account_id,
  shares: String(BigInt(Math.round(sharesEth * 1e18))),
})

describe('calculateDiversityWeightedRatio with evaluatorWeights', () => {
  it('without evaluatorWeights behaves identically to original', () => {
    const support = [divPos('a', 10), divPos('b', 10)]
    const oppose  = [divPos('c', 10)]

    const withoutWeights = calculateDiversityWeightedRatio(support, oppose)
    const withNeutral    = calculateDiversityWeightedRatio(support, oppose, new Map([
      ['a', 1.0], ['b', 1.0], ['c', 1.0],
    ]))

    expect(withoutWeights).toBe(withNeutral)
  })

  it('high-accuracy staker weight boosts their side', () => {
    // Single support staker vs single oppose staker — equal raw shares
    const support = [divPos('good_staker', 10)]
    const oppose  = [divPos('neutral',     10)]

    const neutral = calculateDiversityWeightedRatio(support, oppose)
    expect(neutral).toBe(50) // baseline

    // Good staker gets 1.5x (expert)
    const withBoost = calculateDiversityWeightedRatio(support, oppose, new Map([
      ['good_staker', 1.5],
    ]))
    expect(withBoost).toBeGreaterThan(50)
  })

  it('low-accuracy staker weight reduces their side', () => {
    const support = [divPos('bad_staker', 10)]
    const oppose  = [divPos('neutral',    10)]

    const withPenalty = calculateDiversityWeightedRatio(support, oppose, new Map([
      ['bad_staker', 0.5],
    ]))
    expect(withPenalty).toBeLessThan(50)
  })

  it('missing evaluator entry defaults to 1.0 (neutral)', () => {
    const support = [divPos('known', 10), divPos('unknown', 10)]
    const oppose  = [divPos('other', 10)]

    const withPartialMap = calculateDiversityWeightedRatio(support, oppose, new Map([
      ['known', 1.2],
      // 'unknown' not in map — should default to 1.0
    ]))

    // 'known' has 1.2x, 'unknown' has 1.0x → support side slightly boosted
    const withBothNeutral = calculateDiversityWeightedRatio(support, oppose, new Map([
      ['known', 1.0],
      ['unknown', 1.0],
    ]))

    expect(withPartialMap).toBeGreaterThanOrEqual(withBothNeutral)
  })

  it('evaluator weights do not break existing diversity dampening', () => {
    // Whale on support side still gets dampened even if they have 1.5x evaluator weight
    const support = [divPos('whale', 100)]  // 100% of support → 0.5x diversity weight
    const oppose  = [divPos('a', 10), divPos('b', 10)]

    const withoutEval = calculateDiversityWeightedRatio(support, oppose)
    const withMaxEval = calculateDiversityWeightedRatio(support, oppose, new Map([
      ['whale', 1.5],
    ]))

    // Both should be > 50 (support dominates even dampened), but whale+eval should be higher
    expect(withoutEval).toBeGreaterThan(50)
    expect(withMaxEval).toBeGreaterThan(withoutEval)
    // But NOT more than if we removed the diversity dampening entirely (< 100%)
    expect(withMaxEval).toBeLessThan(100)
  })
})
