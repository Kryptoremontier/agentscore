/**
 * Verifies the list vs. detail qualityScore contract:
 *   - list path (rowToAgentItem via computeScoreEnvelope): qualityScore=null, objectScore=null,
 *     tier derived from trustScore alone.
 *   - detail path (getAgentTrustBreakdown composite): qualityScore=<number>, objectScore=<number>,
 *     tier derived from objectScore.
 *
 * These tests exercise computeScoreEnvelope() directly — no HTTP, no GraphQL.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { computeScoreEnvelope } from '../engine'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-04-27T00:00:00.000Z'))
})
afterEach(() => { vi.useRealTimers() })

describe('list path — qualityScore: null', () => {
  it('returns objectScore: null when qualityScore is null', () => {
    const env = computeScoreEnvelope({
      objectType: 'agent',
      trustScore: 72,
      qualityScore: null,
      supportRatio: 0.75,
      softGateActive: false,
    })
    expect(env.qualityScore).toBeNull()
    expect(env.objectScore).toBeNull()
  })

  it('tier comes from trustScore alone when objectScore is null', () => {
    // trustScore 72 → 'good' in getHybridLevel (≥60)
    const env = computeScoreEnvelope({ objectType: 'agent', trustScore: 72, qualityScore: null })
    expect(env.objectScore).toBeNull()
    expect(env.tier).toBe('good')
  })

  it('agentScore alias equals trustScore when objectScore is null', () => {
    const trustScore = 65
    const env = computeScoreEnvelope({ objectType: 'agent', trustScore, qualityScore: null })
    // deprecated alias: objectScore ?? trustScore
    const agentScore = env.objectScore ?? env.trustScore
    expect(agentScore).toBe(trustScore)
  })

  it('softGateActive=true does not produce objectScore', () => {
    const env = computeScoreEnvelope({
      objectType: 'agent',
      trustScore: 30,
      qualityScore: null,
      softGateActive: true,
    })
    expect(env.objectScore).toBeNull()
    expect(env.softGateActive).toBe(true)
    // tier still from trustScore: 30 → 'low' (≥20)
    expect(env.tier).toBe('low')
  })
})

describe('detail path — full 4-pillar composite', () => {
  it('returns objectScore when qualityScore is provided', () => {
    // trustScore=80, qualityScore=60 → objectScore = 80*0.6 + 60*0.4 = 72
    const env = computeScoreEnvelope({
      objectType: 'agent',
      trustScore: 80,
      qualityScore: 60,
      supportRatio: 0.8,
      softGateActive: false,
    })
    expect(env.qualityScore).toBe(60)
    expect(env.objectScore).toBe(72)
  })

  it('tier comes from objectScore when present', () => {
    // objectScore 72 → 'good' (≥60 in getHybridLevel)
    const env = computeScoreEnvelope({ objectType: 'agent', trustScore: 80, qualityScore: 60 })
    expect(env.tier).toBe('good')
  })

  it('agentScore alias equals objectScore in detail path', () => {
    const env = computeScoreEnvelope({ objectType: 'agent', trustScore: 80, qualityScore: 60 })
    const agentScore = env.objectScore ?? env.trustScore
    expect(agentScore).toBe(env.objectScore)
    expect(agentScore).toBe(72)
  })

  it('tier reflects full composite — lower qualityScore pulls tier down vs trustScore alone', () => {
    // trustScore alone (85) → tier 'excellent' (≥80)
    // objectScore = 85*0.6 + 40*0.4 = 51+16 = 67 → tier 'good' (≥60)
    const env = computeScoreEnvelope({ objectType: 'agent', trustScore: 85, qualityScore: 40 })
    expect(env.objectScore).toBe(67)
    expect(env.tier).toBe('good') // pulled down from 'excellent'
  })

  it('high qualityScore can pull tier up vs trustScore alone', () => {
    // trustScore 45 → tier 'low' (≥20) alone
    // objectScore = 45*0.6 + 95*0.4 = 27+38 = 65 → tier 'good' (≥60)
    const env = computeScoreEnvelope({ objectType: 'agent', trustScore: 45, qualityScore: 95 })
    expect(env.objectScore).toBe(65)
    expect(env.tier).toBe('good') // pulled up from 'low'
  })
})
