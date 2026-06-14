import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { computeScoreEnvelope } from '../engine'

// Pin computedAt so snapshot tests don't flicker
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-04-27T00:00:00.000Z'))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('computeScoreEnvelope', () => {
  it('produces objectScore = 0.6×trust + 0.4×quality when both scores present', () => {
    const env = computeScoreEnvelope({ objectType: 'agent', trustScore: 80, qualityScore: 60 })
    // 80*0.6 + 60*0.4 = 48 + 24 = 72
    expect(env.objectScore).toBe(72)
    expect(env.trustScore).toBe(80)
    expect(env.qualityScore).toBe(60)
  })

  it('sets objectScore null when qualityScore is null', () => {
    const env = computeScoreEnvelope({ objectType: 'agent', trustScore: 75, qualityScore: null })
    expect(env.objectScore).toBeNull()
    expect(env.qualityScore).toBeNull()
  })

  it('derives tier from objectScore when present', () => {
    // objectScore 72 → 'good' (≥60 in getHybridLevel)
    const env = computeScoreEnvelope({ objectType: 'agent', trustScore: 80, qualityScore: 60 })
    expect(env.tier).toBe('good')
  })

  it('falls back to trustScore for tier when objectScore is null', () => {
    // trustScore 85 → 'excellent' (≥80)
    const env = computeScoreEnvelope({ objectType: 'agent', trustScore: 85, qualityScore: null })
    expect(env.tier).toBe('excellent')
  })

  it('tier is critical for very low scores', () => {
    const env = computeScoreEnvelope({ objectType: 'agent', trustScore: 10, qualityScore: 5 })
    // 10*0.6 + 5*0.4 = 6+2 = 8 → critical (<20)
    expect(env.tier).toBe('critical')
  })

  it('respects objectType field', () => {
    const agent = computeScoreEnvelope({ objectType: 'agent', trustScore: 50, qualityScore: 50 })
    const project = computeScoreEnvelope({ objectType: 'project', trustScore: 50, qualityScore: 50 })
    expect(agent.objectType).toBe('agent')
    expect(project.objectType).toBe('project')
  })

  it('defaults softGateActive to false', () => {
    const env = computeScoreEnvelope({ objectType: 'agent', trustScore: 70, qualityScore: 70 })
    expect(env.softGateActive).toBe(false)
  })

  it('passes through softGateActive when provided', () => {
    const gated = computeScoreEnvelope({ objectType: 'agent', trustScore: 90, qualityScore: 90, softGateActive: true })
    const clear = computeScoreEnvelope({ objectType: 'agent', trustScore: 90, qualityScore: 90, softGateActive: false })
    expect(gated.softGateActive).toBe(true)
    expect(clear.softGateActive).toBe(false)
  })

  it('sets computedAt to current ISO timestamp', () => {
    const env = computeScoreEnvelope({ objectType: 'agent', trustScore: 60, qualityScore: 60 })
    expect(env.computedAt).toBe('2026-04-27T00:00:00.000Z')
  })

  it('full envelope shape matches ScoreEnvelope interface', () => {
    const env = computeScoreEnvelope({ objectType: 'skill', trustScore: 65, qualityScore: 70 })
    expect(env).toMatchObject({
      objectType: 'skill',
      trustScore: 65,
      qualityScore: 70,
      objectScore: expect.any(Number),
      tier: expect.stringMatching(/^(excellent|good|moderate|low|critical)$/),
      softGateActive: false,
      computedAt: expect.any(String),
    })
  })

  it('rounds objectScore to one decimal place', () => {
    // 55*0.6 + 33*0.4 = 33 + 13.2 = 46.2
    const env = computeScoreEnvelope({ objectType: 'agent', trustScore: 55, qualityScore: 33 })
    expect(env.objectScore).toBe(46.2)
  })

  it('boundary: trustScore=100, qualityScore=100 → objectScore=100', () => {
    const env = computeScoreEnvelope({ objectType: 'agent', trustScore: 100, qualityScore: 100 })
    expect(env.objectScore).toBe(100)
    expect(env.tier).toBe('excellent')
  })

  it('boundary: trustScore=0, qualityScore=0 → objectScore=0', () => {
    const env = computeScoreEnvelope({ objectType: 'agent', trustScore: 0, qualityScore: 0 })
    expect(env.objectScore).toBe(0)
    expect(env.tier).toBe('critical')
  })
})
