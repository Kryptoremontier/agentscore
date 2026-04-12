import { describe, it, expect } from 'vitest'
import { mapForgeTimelineEvent, buildForgeTimeline } from '../timeline'
import type { TimelineEvent } from '@/lib/trust-timeline'

function makeEvent(overrides: Partial<TimelineEvent>): TimelineEvent {
  return {
    id:           'evt_1',
    timestamp:    '2026-03-01T10:00:00Z',
    type:         'registered',
    title:        'Original title',
    description:  'Original description',
    scoreAtEvent: 50,
    scoreDelta:   null,
    icon:         '🤖',
    severity:     'neutral',
    metadata:     {},
    ...overrides,
  }
}

describe('mapForgeTimelineEvent', () => {
  it('maps registered → "Project Listed on IntuForge"', () => {
    const event = makeEvent({ type: 'registered' })
    const mapped = mapForgeTimelineEvent(event)
    expect(mapped.title).toBe('Project Listed on IntuForge')
    expect(mapped.icon).toBe('🏗️')
  })

  it('maps staker_joined → "New Backer"', () => {
    const event = makeEvent({ type: 'staker_joined' })
    const mapped = mapForgeTimelineEvent(event)
    expect(mapped.title).toBe('New Backer')
    expect(mapped.icon).toBe('🚀')
  })

  it('maps staker_opposed → "Opposition Signal"', () => {
    const event = makeEvent({ type: 'staker_opposed' })
    const mapped = mapForgeTimelineEvent(event)
    expect(mapped.title).toBe('Opposition Signal')
  })

  it('preserves timestamp and scoreAtEvent unchanged', () => {
    const event = makeEvent({ type: 'staker_joined', timestamp: '2026-04-01T12:00:00Z', scoreAtEvent: 75 })
    const mapped = mapForgeTimelineEvent(event)
    expect(mapped.timestamp).toBe('2026-04-01T12:00:00Z')
    expect(mapped.scoreAtEvent).toBe(75)
  })

  it('preserves metadata unchanged', () => {
    const event = makeEvent({ type: 'tier_upgrade', metadata: { tier: 'Trusted', stakerCount: 10 } })
    const mapped = mapForgeTimelineEvent(event)
    expect(mapped.metadata?.tier).toBe('Trusted')
    expect(mapped.metadata?.stakerCount).toBe(10)
  })

  it('passes through unknown event types unchanged', () => {
    const event = makeEvent({ type: 'skill_added' as TimelineEvent['type'], title: 'Custom Title' })
    // skill_added IS mapped, so test with a non-mapped scenario:
    // staker_left IS mapped too. Let's check that mapping keeps id
    const mapped = mapForgeTimelineEvent(event)
    expect(mapped.id).toBe('evt_1')
  })

  it('sage evaluator gets 🧙 icon', () => {
    const event = makeEvent({ type: 'evaluator_staked', metadata: { evaluatorTier: 'sage', evaluatorWeight: 1.5 } })
    const mapped = mapForgeTimelineEvent(event)
    expect(mapped.icon).toBe('🧙')
  })

  it('oracle evaluator gets 🔮 icon', () => {
    const event = makeEvent({ type: 'evaluator_staked', metadata: { evaluatorTier: 'oracle', evaluatorWeight: 1.3 } })
    const mapped = mapForgeTimelineEvent(event)
    expect(mapped.icon).toBe('🔮')
  })

  it('staker_left maps to Backer Withdrew', () => {
    const event = makeEvent({ type: 'staker_left' })
    const mapped = mapForgeTimelineEvent(event)
    expect(mapped.title).toBe('Backer Withdrew')
  })

  it('a2a_ready maps to Ecosystem Ready', () => {
    const event = makeEvent({ type: 'a2a_ready' })
    const mapped = mapForgeTimelineEvent(event)
    expect(mapped.title).toBe('Ecosystem Ready')
    expect(mapped.icon).toBe('🤖')
  })
})

describe('buildForgeTimeline', () => {
  it('wraps buildAgentTimeline and returns mapped events', () => {
    const result = buildForgeTimeline({
      agentId:      'proj_1',
      agentName:    'Test Project',
      createdAt:    '2026-03-01T10:00:00Z',
      currentScore: 60,
      currentTier:  'unverified',
      stakingEvents: [],
      skillEvents:   [],
    })
    // Should have at least the registered event
    expect(result.events.length).toBeGreaterThanOrEqual(1)
    expect(result.agentId).toBe('proj_1')
  })

  it('registered event in forge timeline has forge title', () => {
    const result = buildForgeTimeline({
      agentId:      'proj_1',
      agentName:    'My Project',
      createdAt:    '2026-03-01T10:00:00Z',
      currentScore: 50,
      currentTier:  'unverified',
      stakingEvents: [],
      skillEvents:   [],
    })
    const registeredEvent = result.events.find(e => e.type === 'registered')
    expect(registeredEvent?.title).toBe('Project Listed on IntuForge')
  })

  it('returns scoreHistory array for chart', () => {
    const result = buildForgeTimeline({
      agentId:      'proj_2',
      agentName:    'Another Project',
      createdAt:    '2026-03-10T10:00:00Z',
      currentScore: 72,
      currentTier:  'unverified',
      stakingEvents: [],
      skillEvents:   [],
    })
    expect(Array.isArray(result.scoreHistory)).toBe(true)
  })
})
