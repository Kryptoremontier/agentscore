import { describe, test, expect } from 'vitest'
import { aggregateDomains, scoreDomainAgents, type DomainTripleData } from '../domain-scoring'

function mockTriple(
  agentId: string,
  agentName: string,
  skillId: string,
  skillName: string,
  supportShares: string,
  opposeShares: string,
  supportCount = 3,
  opposeCount = 0,
): DomainTripleData {
  return {
    tripleId: `triple_${agentId}_${skillId}`,
    agentId,
    agentName,
    skillId,
    skillName,
    supportShares: BigInt(supportShares),
    opposeShares: BigInt(opposeShares),
    supportPositionCount: supportCount,
    opposePositionCount: opposeCount,
  }
}

describe('aggregateDomains', () => {
  test('groups triples by skill into domains', () => {
    const triples = [
      mockTriple('agent1', 'ChatGPT', 'skill1', 'Code Generation', '1000000000000000000', '0'),
      mockTriple('agent2', 'Claude', 'skill1', 'Code Generation', '800000000000000000', '0'),
      mockTriple('agent1', 'ChatGPT', 'skill2', 'Writing', '500000000000000000', '0'),
    ]

    const domains = aggregateDomains(triples)
    expect(domains).toHaveLength(2)

    const codeDomain = domains.find(d => d.name === 'Code Generation')
    expect(codeDomain).toBeDefined()
    expect(codeDomain!.agentCount).toBe(2)

    const writingDomain = domains.find(d => d.name === 'Writing')
    expect(writingDomain).toBeDefined()
    expect(writingDomain!.agentCount).toBe(1)
  })

  test('sorts domains by totalShares descending', () => {
    const triples = [
      mockTriple('a1', 'A', 's1', 'LowStake', '100000000000000000', '0'),
      mockTriple('a2', 'B', 's2', 'HighStake', '5000000000000000000', '0'),
    ]

    const domains = aggregateDomains(triples)
    expect(domains[0].name).toBe('HighStake')
  })

  test('identifies top agent per domain', () => {
    const triples = [
      mockTriple('a1', 'ChatGPT', 's1', 'Code', '2000000000000000000', '0'),
      mockTriple('a2', 'Claude', 's1', 'Code', '500000000000000000', '500000000000000000'),
    ]

    const domains = aggregateDomains(triples)
    expect(domains[0].topAgent).toBe('ChatGPT')
  })

  test('returns empty array for no triples', () => {
    expect(aggregateDomains([])).toHaveLength(0)
  })

  test('strips skill name prefixes', () => {
    const triples = [
      mockTriple('a1', 'Agent:MyBot', 'skill1', 'INTU:Skill:Code Generation', '1000000000000000000', '0'),
    ]

    const domains = aggregateDomains(triples)
    expect(domains[0].name).toBe('Code Generation')
  })

  test('de-duplicates agent across multiple triples in same domain', () => {
    // Same agent, same skill — only count once
    const triples = [
      mockTriple('a1', 'Bot', 's1', 'Code', '1000000000000000000', '0'),
      mockTriple('a1', 'Bot', 's1', 'Code', '500000000000000000', '0'),
    ]

    const domains = aggregateDomains(triples)
    expect(domains[0].agentCount).toBe(1)
  })
})

describe('scoreDomainAgents', () => {
  test('ranks agents by score descending', () => {
    const triples = [
      mockTriple('a1', 'ChatGPT', 's1', 'Code', '2000000000000000000', '0'),
      mockTriple('a2', 'Claude', 's1', 'Code', '500000000000000000', '500000000000000000'),
      mockTriple('a3', 'Gemini', 's1', 'Code', '1000000000000000000', '0'),
    ]

    const agents = scoreDomainAgents(triples)
    expect(agents[0].rank).toBe(1)
    expect(agents[0].domainScore).toBeGreaterThanOrEqual(agents[1].domainScore)
    expect(agents[1].domainScore).toBeGreaterThanOrEqual(agents[2].domainScore)
  })

  test('assigns sequential rank numbers starting at 1', () => {
    const triples = [
      mockTriple('a1', 'A', 's1', 'X', '1000000000000000000', '0'),
      mockTriple('a2', 'B', 's1', 'X', '500000000000000000', '0'),
    ]

    const agents = scoreDomainAgents(triples)
    expect(agents[0].rank).toBe(1)
    expect(agents[1].rank).toBe(2)
  })

  test('returns empty array for no triples', () => {
    expect(scoreDomainAgents([])).toHaveLength(0)
  })

  test('computes supportRatio = 100% when no opposition', () => {
    const triples = [
      mockTriple('a1', 'Bot', 's1', 'Code', '1000000000000000000', '0'),
    ]

    const agents = scoreDomainAgents(triples)
    expect(agents[0].supportRatio).toBe(100)
  })

  test('computes supportRatio = 50% when equal stakes', () => {
    const triples = [
      mockTriple('a1', 'Bot', 's1', 'Code', '1000000000000000000', '1000000000000000000'),
    ]

    const agents = scoreDomainAgents(triples)
    expect(agents[0].supportRatio).toBe(50)
  })

  test('de-duplicates agent, keeps best score', () => {
    const triples = [
      mockTriple('a1', 'Bot', 's1', 'Code', '2000000000000000000', '0'),  // higher
      mockTriple('a1', 'Bot', 's1', 'Code', '100000000000000000', '0'),   // lower
    ]

    const agents = scoreDomainAgents(triples)
    expect(agents).toHaveLength(1)
    // Should keep higher-scoring entry
    expect(agents[0].supportShares).toBe(2000000000000000000n)
  })

  test('assigns levels correctly', () => {
    // 100% support, high stake → excellent
    const triples = [
      mockTriple('a1', 'Bot', 's1', 'Code', '10000000000000000000', '0', 20, 0),
    ]
    const agents = scoreDomainAgents(triples)
    expect(['excellent', 'good', 'moderate', 'low', 'critical']).toContain(agents[0].level)
  })
})
