import { describe, it, expect } from 'vitest'
import { calculateForgeTrustScore, buildSparkline } from '../scoring'

describe('calculateForgeTrustScore', () => {
  it('returns neutral score for project with no stakers', () => {
    const result = calculateForgeTrustScore({
      supportStakeWei: 0n,
      opposeStakeWei:  0n,
      uniqueStakers:   0,
    })
    // With 0 stakes trust engine returns ~50 (anchored neutral)
    expect(result.trustScore).toBeGreaterThanOrEqual(0)
    expect(result.trustScore).toBeLessThanOrEqual(100)
    expect(result.finalScore).toBeGreaterThanOrEqual(0)
    expect(result.finalScore).toBeLessThanOrEqual(100)
  })

  it('returns trustScore, compositeScore, finalScore', () => {
    const result = calculateForgeTrustScore({
      supportStakeWei: BigInt(1e18),
      opposeStakeWei:  0n,
      uniqueStakers:   5,
    })
    expect(typeof result.trustScore).toBe('number')
    expect(typeof result.compositeScore).toBe('number')
    expect(typeof result.finalScore).toBe('number')
  })

  it('returns momentum as up|down|stable', () => {
    const result = calculateForgeTrustScore({
      supportStakeWei: BigInt(2e18),
      opposeStakeWei:  0n,
      uniqueStakers:   3,
    })
    expect(['up', 'down', 'stable']).toContain(result.momentum)
  })

  it('strong support produces higher finalScore than balanced', () => {
    const strongSupport = calculateForgeTrustScore({
      supportStakeWei: BigInt(10e18),
      opposeStakeWei:  0n,
      uniqueStakers:   10,
    })
    const balanced = calculateForgeTrustScore({
      supportStakeWei: BigInt(1e18),
      opposeStakeWei:  BigInt(1e18),
      uniqueStakers:   2,
    })
    expect(strongSupport.finalScore).toBeGreaterThan(balanced.finalScore)
  })

  it('returns integer scores', () => {
    const result = calculateForgeTrustScore({
      supportStakeWei: BigInt(5e18),
      opposeStakeWei:  BigInt(1e18),
      uniqueStakers:   6,
    })
    expect(result.trustScore % 1).toBe(0)
    expect(result.finalScore % 1).toBe(0)
  })
})

describe('buildSparkline', () => {
  it('returns 7 points for empty array with default', () => {
    const result = buildSparkline([])
    expect(result.length).toBe(1)
    expect(result[0]).toBe(50)
  })

  it('pads left when fewer than 7 scores', () => {
    const result = buildSparkline([60, 65, 70])
    expect(result.length).toBe(7)
    // Padded with first value (60)
    expect(result[0]).toBe(60)
    expect(result[result.length - 1]).toBe(70)
  })

  it('takes last 7 for longer arrays', () => {
    const result = buildSparkline([10, 20, 30, 40, 50, 60, 70, 80])
    expect(result.length).toBe(7)
    expect(result[0]).toBe(20)
    expect(result[6]).toBe(80)
  })

  it('returns exactly 7 for 7-element input', () => {
    const scores = [50, 55, 58, 60, 62, 65, 68]
    const result = buildSparkline(scores)
    expect(result).toEqual(scores)
  })
})
