import { describe, test, expect } from 'vitest'
import { buildAgentTimeline, type StakingEvent, type SkillEvent } from '../trust-timeline'

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeSupport(id: string, timestamp: string, accountId = `0x${id}`): StakingEvent {
  return { id, accountId, type: 'deposit', side: 'support', deltaWei: '1000000000000000000', timestamp }
}

function makeOppose(id: string, timestamp: string): StakingEvent {
  return { id, accountId: `0x${id}`, type: 'deposit', side: 'oppose', deltaWei: '500000000000000000', timestamp }
}

function makeRedeem(id: string, timestamp: string): StakingEvent {
  return { id, accountId: `0x${id}`, type: 'redeem', side: 'support', deltaWei: '1000000000000000000', timestamp }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildAgentTimeline', () => {
  test('registration event created when createdAt provided', () => {
    const tl = buildAgentTimeline({
      agentId: 'test1', agentName: 'TestAgent',
      createdAt: '2026-03-01T00:00:00Z',
      currentScore: 72, currentTier: 'trusted',
      stakingEvents: [], skillEvents: [],
    })
    expect(tl.events).toHaveLength(1)
    expect(tl.events[0].type).toBe('registered')
    expect(tl.events[0].scoreAtEvent).toBe(50)
    expect(tl.events[0].severity).toBe('milestone')
  })

  test('staker_joined and staker_opposed detected from deposits', () => {
    const tl = buildAgentTimeline({
      agentId: 'test2', agentName: 'TestAgent',
      currentScore: 65, currentTier: 'sandbox',
      stakingEvents: [
        makeSupport('p1', '2026-03-05T00:00:00Z'),
        makeOppose('p2', '2026-03-06T00:00:00Z'),
      ],
      skillEvents: [],
    })
    const types = tl.events.map(e => e.type)
    expect(types).toContain('staker_joined')
    expect(types).toContain('staker_opposed')
  })

  test('staker_left event from redeem signal', () => {
    const tl = buildAgentTimeline({
      agentId: 'test3', agentName: 'TestAgent',
      currentScore: 55, currentTier: 'sandbox',
      stakingEvents: [makeRedeem('r1', '2026-03-10T00:00:00Z')],
      skillEvents: [],
    })
    expect(tl.events.some(e => e.type === 'staker_left')).toBe(true)
    expect(tl.events.find(e => e.type === 'staker_left')?.severity).toBe('neutral')
  })

  test('skill_added events from skill triples', () => {
    const skills: SkillEvent[] = [
      { tripleId: 't1', skillId: 's1', skillName: 'Code Generation', timestamp: '2026-03-10T00:00:00Z' },
    ]
    const tl = buildAgentTimeline({
      agentId: 'test4', agentName: 'TestAgent',
      currentScore: 70, currentTier: 'sandbox',
      stakingEvents: [], skillEvents: skills,
    })
    const skillEv = tl.events.filter(e => e.type === 'skill_added')
    expect(skillEv).toHaveLength(1)
    expect(skillEv[0].title).toContain('Code Generation')
    expect(skillEv[0].icon).toBe('⚡')
  })

  test('tier upgrade at 3, 10, 25 unique stakers', () => {
    const positions: StakingEvent[] = Array.from({ length: 25 }, (_, i) => ({
      id: `p${i}`,
      accountId: `0x${i.toString(16).padStart(4, '0')}`,
      type: 'deposit',
      side: 'support',
      deltaWei: '1000',
      timestamp: `2026-03-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
    }))
    const tl = buildAgentTimeline({
      agentId: 'test5', agentName: 'TestAgent',
      currentScore: 80, currentTier: 'verified',
      stakingEvents: positions, skillEvents: [],
    })
    const tierTitles = tl.events
      .filter(e => e.type === 'tier_upgrade')
      .map(e => e.title)
    expect(tierTitles).toContain('Reached Sandbox Tier')
    expect(tierTitles).toContain('Reached Trusted Tier')
    expect(tierTitles).toContain('Reached Verified Tier')
  })

  test('tier milestones not duplicated for same account depositing twice', () => {
    const positions: StakingEvent[] = [
      makeSupport('d1', '2026-03-01T00:00:00Z', '0xaaa'),
      makeSupport('d2', '2026-03-02T00:00:00Z', '0xaaa'), // same account!
      makeSupport('d3', '2026-03-03T00:00:00Z', '0xbbb'),
      makeSupport('d4', '2026-03-04T00:00:00Z', '0xccc'),
    ]
    const tl = buildAgentTimeline({
      agentId: 'test6', agentName: 'TestAgent',
      currentScore: 60, currentTier: 'sandbox',
      stakingEvents: positions, skillEvents: [],
    })
    const tierEvents = tl.events.filter(e => e.type === 'tier_upgrade')
    // Should reach Sandbox at 3 unique accounts, not at position count 3
    expect(tierEvents).toHaveLength(1) // only Sandbox (3 unique stakers)
    expect(tierEvents[0].metadata?.tier).toBe('Sandbox')
    expect(tierEvents[0].metadata?.stakerCount).toBe(3)
  })

  test('Oracle evaluator staked event when weight >= 1.25', () => {
    const evaluatorWeights = new Map([['0xoracle', 1.28]])
    const tl = buildAgentTimeline({
      agentId: 'test7', agentName: 'TestAgent',
      currentScore: 75, currentTier: 'trusted',
      stakingEvents: [makeSupport('p1', '2026-03-15T00:00:00Z', '0xoracle')],
      skillEvents: [],
      evaluatorWeights,
    })
    const evalEv = tl.events.filter(e => e.type === 'evaluator_staked')
    expect(evalEv).toHaveLength(1)
    expect(evalEv[0].title).toContain('Oracle')
    expect(evalEv[0].severity).toBe('positive')
  })

  test('events sorted newest first', () => {
    const tl = buildAgentTimeline({
      agentId: 'test8', agentName: 'Test',
      createdAt: '2026-03-01T00:00:00Z',
      currentScore: 60, currentTier: 'sandbox',
      stakingEvents: [
        makeSupport('p1', '2026-03-05T00:00:00Z'),
        makeSupport('p2', '2026-03-10T00:00:00Z'),
      ],
      skillEvents: [],
    })
    for (let i = 0; i < tl.events.length - 1; i++) {
      const a = new Date(tl.events[i].timestamp).getTime()
      const b = new Date(tl.events[i + 1].timestamp).getTime()
      expect(a).toBeGreaterThanOrEqual(b) // newest first
    }
  })

  test('summary daysActive matches createdAt', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000).toISOString()
    const tl = buildAgentTimeline({
      agentId: 'test9', agentName: 'Test',
      createdAt: tenDaysAgo,
      currentScore: 55, currentTier: 'unverified',
      stakingEvents: [], skillEvents: [],
    })
    expect(tl.summary.daysActive).toBeGreaterThanOrEqual(9)
    expect(tl.summary.daysActive).toBeLessThanOrEqual(11)
  })

  test('empty timeline for agent with no data', () => {
    const tl = buildAgentTimeline({
      agentId: 'empty', agentName: 'Empty',
      currentScore: 50, currentTier: 'unverified',
      stakingEvents: [], skillEvents: [],
    })
    expect(tl.events).toHaveLength(0)
    expect(tl.summary.totalEvents).toBe(0)
    expect(tl.summary.currentStreak).toBe('No activity yet')
  })

  test('score history starts at 50 and ends at currentScore', () => {
    const tl = buildAgentTimeline({
      agentId: 'hist1', agentName: 'Test',
      createdAt: '2026-03-01T00:00:00Z',
      currentScore: 75, currentTier: 'trusted',
      stakingEvents: [makeSupport('p1', '2026-03-10T00:00:00Z')],
      skillEvents: [],
    })
    expect(tl.scoreHistory.length).toBeGreaterThan(2)
    expect(tl.scoreHistory[0].score).toBe(50)
    expect(tl.scoreHistory[tl.scoreHistory.length - 1].score).toBe(75)
  })
})
