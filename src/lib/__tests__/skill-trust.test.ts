import { describe, test, expect } from 'vitest'
import { calculateSkillBreakdown } from '../skill-trust'

describe('calculateSkillBreakdown', () => {
  test('returns hasSkills=false when no skill triples', () => {
    const result = calculateSkillBreakdown([])
    expect(result.hasSkills).toBe(false)
    expect(result.skills).toHaveLength(0)
  })

  test('calculates score per skill triple', () => {
    const triples = [
      {
        id: 'triple1',
        predicate: { label: 'hasAgentSkill' },
        object: { id: 'skill1', label: 'Code Generation' },
        vault: { totalShares: '1000000000000000000', currentSharePrice: '1000000000000000000', positionCount: 5 },
        counterVault: { totalShares: '0', currentSharePrice: '0', positionCount: 0 },
      },
      {
        id: 'triple2',
        predicate: { label: 'hasAgentSkill' },
        object: { id: 'skill2', label: 'Medical Advice' },
        vault: { totalShares: '100000000000000000', currentSharePrice: '1000000000000000000', positionCount: 2 },
        counterVault: { totalShares: '500000000000000000', currentSharePrice: '1000000000000000000', positionCount: 3 },
      },
    ]

    const result = calculateSkillBreakdown(triples)
    expect(result.hasSkills).toBe(true)
    expect(result.skills).toHaveLength(2)

    // Code Generation should score higher (100% support)
    expect(result.skills[0].skillName).toBe('Code Generation')
    expect(result.skills[0].score).toBeGreaterThan(result.skills[1].score)

    // Medical Advice has more oppose than support
    expect(result.skills[1].skillName).toBe('Medical Advice')
    expect(result.skills[1].supportRatio).toBeLessThan(50)
  })

  test('weighted average gives more weight to higher-stake skills', () => {
    const triples = [
      {
        id: 'triple1',
        predicate: { label: 'hasAgentSkill' },
        object: { id: 'skill1', label: 'High Stake Skill' },
        vault: { totalShares: '10000000000000000000', currentSharePrice: '1000000000000000000', positionCount: 10 },
        counterVault: { totalShares: '0', currentSharePrice: '0', positionCount: 0 },
      },
      {
        id: 'triple2',
        predicate: { label: 'hasAgentSkill' },
        object: { id: 'skill2', label: 'Low Stake Skill' },
        vault: { totalShares: '100000000000000000', currentSharePrice: '1000000000000000000', positionCount: 1 },
        counterVault: { totalShares: '100000000000000000', currentSharePrice: '1000000000000000000', positionCount: 1 },
      },
    ]

    const result = calculateSkillBreakdown(triples)
    // Overall should be closer to High Stake Skill score (high support)
    // than to Low Stake Skill score (50/50)
    expect(result.overallScore).toBeGreaterThan(60)
  })

  test('filters only hasAgentSkill predicate triples', () => {
    const triples = [
      {
        id: 'triple1',
        predicate: { label: 'hasAgentSkill' },
        object: { id: 'skill1', label: 'Code' },
        vault: { totalShares: '1000000000000000000', currentSharePrice: '1000000000000000000', positionCount: 3 },
        counterVault: null,
      },
      {
        id: 'triple2',
        predicate: { label: 'trusts' },
        object: { id: 'other1', label: 'SomeAgent' },
        vault: { totalShares: '5000000000000000000', currentSharePrice: '1000000000000000000', positionCount: 10 },
        counterVault: null,
      },
    ]

    const result = calculateSkillBreakdown(triples as any)
    expect(result.skills).toHaveLength(1)
    expect(result.skills[0].skillName).toBe('Code')
  })

  test('backward compat: handles isTrustedFor predicate', () => {
    const triples = [
      {
        id: 'triple1',
        predicate: { label: 'isTrustedFor' },
        object: { id: 'skill1', label: 'INTU:Writing' },
        vault: { totalShares: '1000000000000000000', currentSharePrice: '1000000000000000000', positionCount: 2 },
        counterVault: null,
      },
    ]

    const result = calculateSkillBreakdown(triples as any)
    expect(result.skills).toHaveLength(1)
    expect(result.skills[0].skillName).toBe('Writing') // prefix stripped
  })

  test('handles null vault gracefully', () => {
    const triples = [
      {
        id: 'triple1',
        predicate: { label: 'hasAgentSkill' },
        object: { id: 'skill1', label: 'Empty Skill' },
        vault: null,
        counterVault: null,
      },
    ]

    const result = calculateSkillBreakdown(triples as any)
    expect(result.hasSkills).toBe(true)
    expect(result.skills[0].supportShares).toBe(0n)
    expect(result.skills[0].opposeShares).toBe(0n)
    expect(result.skills[0].supportRatio).toBe(50) // neutral when no stake
  })
})
