/**
 * Agent Domains — domain-level aggregation and per-agent scoring within a domain.
 *
 * Each "domain" is a skill atom. Agents are ranked within a domain
 * by the trust score of their [Agent] [hasAgentSkill] [Skill] triple vault.
 */

import { calculateHybridScore } from './hybrid-trust'
import { calculateTrustScoreFromStakes } from './trust-score-engine'

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Flat triple data, post-fetch (positions already aggregated).
 */
export interface DomainTripleData {
  tripleId: string
  agentId: string
  agentName: string
  skillId: string
  skillName: string
  supportShares: bigint
  opposeShares: bigint
  supportPositionCount: number
  opposePositionCount: number
}

export interface Domain {
  id: string               // skill atom term_id
  name: string             // cleaned skill name
  agentCount: number       // unique agents with this skill
  totalShares: bigint      // raw share sum across all triple vaults in domain
  totalStakers: number     // sum of position counts
  topAgent: string | null  // name of #1 ranked agent
  topAgentScore: number    // score of #1 agent (0-100)
}

export interface DomainAgent {
  agentId: string
  agentName: string
  tripleId: string
  domainScore: number      // 0-100
  supportShares: bigint
  opposeShares: bigint
  supportRatio: number     // 0-100%
  stakerCount: number
  rank: number             // 1 = best
  level: string            // excellent/good/moderate/low/critical
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function cleanDomainName(label: string): string {
  let result = label.trim()
  const prefixRe = /^(INTU:|Skill:|Agent:)\s*/i
  while (prefixRe.test(result)) {
    result = result.replace(prefixRe, '').trim()
  }
  // "Name - description" → "Name"
  const dashIdx = result.indexOf(' - ')
  if (dashIdx > 0) result = result.slice(0, dashIdx)
  return result
}

function getLevel(score: number): string {
  if (score >= 80) return 'excellent'
  if (score >= 60) return 'good'
  if (score >= 40) return 'moderate'
  if (score >= 20) return 'low'
  return 'critical'
}

function scoreTriple(supportShares: bigint, opposeShares: bigint): number {
  const totalShares = supportShares + opposeShares
  const supportRatio = totalShares > 0n
    ? Number((supportShares * 100n) / totalShares)
    : 50
  const trustResult = calculateTrustScoreFromStakes(supportShares, opposeShares)
  return calculateHybridScore(trustResult.score, trustResult.score, supportRatio)
}

// ─── Aggregation ─────────────────────────────────────────────────────────────

/**
 * Aggregate triples into unique domains, sorted by totalShares descending.
 */
export function aggregateDomains(triples: DomainTripleData[]): Domain[] {
  const domainMap = new Map<string, {
    id: string
    name: string
    agents: Map<string, { score: number; name: string }>
    totalShares: bigint
    totalStakers: number
  }>()

  for (const triple of triples) {
    if (!triple.skillId) continue

    if (!domainMap.has(triple.skillId)) {
      domainMap.set(triple.skillId, {
        id: triple.skillId,
        name: cleanDomainName(triple.skillName),
        agents: new Map(),
        totalShares: 0n,
        totalStakers: 0,
      })
    }

    const domain = domainMap.get(triple.skillId)!
    const score = scoreTriple(triple.supportShares, triple.opposeShares)

    if (triple.agentId) {
      const existing = domain.agents.get(triple.agentId)
      if (!existing || score > existing.score) {
        domain.agents.set(triple.agentId, {
          score,
          name: cleanDomainName(triple.agentName),
        })
      }
    }

    domain.totalShares += triple.supportShares + triple.opposeShares
    domain.totalStakers += triple.supportPositionCount + triple.opposePositionCount
  }

  const domains: Domain[] = []
  for (const [, d] of domainMap) {
    let topAgent: string | null = null
    let topScore = -1
    for (const [, agent] of d.agents) {
      if (agent.score > topScore) {
        topScore = agent.score
        topAgent = agent.name
      }
    }

    domains.push({
      id: d.id,
      name: d.name,
      agentCount: d.agents.size,
      totalShares: d.totalShares,
      totalStakers: d.totalStakers,
      topAgent,
      topAgentScore: topScore >= 0 ? Math.round(topScore * 10) / 10 : 0,
    })
  }

  // Most active domains first
  domains.sort((a, b) => (a.totalShares > b.totalShares ? -1 : a.totalShares < b.totalShares ? 1 : 0))
  return domains
}

/**
 * Score and rank agents within a specific domain.
 * Input: triples already filtered to a single skill.
 */
export function scoreDomainAgents(triples: DomainTripleData[]): DomainAgent[] {
  // De-duplicate by agentId, keeping best score
  const agentMap = new Map<string, DomainAgent>()

  for (const triple of triples) {
    if (!triple.agentId) continue

    const totalShares = triple.supportShares + triple.opposeShares
    const supportRatio = totalShares > 0n
      ? Number((triple.supportShares * 100n) / totalShares)
      : 50

    const trustResult = calculateTrustScoreFromStakes(triple.supportShares, triple.opposeShares)
    const score = calculateHybridScore(trustResult.score, trustResult.score, supportRatio)
    const stakerCount = triple.supportPositionCount + triple.opposePositionCount

    const existing = agentMap.get(triple.agentId)
    if (!existing || score > existing.domainScore) {
      agentMap.set(triple.agentId, {
        agentId: triple.agentId,
        agentName: cleanDomainName(triple.agentName),
        tripleId: triple.tripleId,
        domainScore: Math.round(score * 10) / 10,
        supportShares: triple.supportShares,
        opposeShares: triple.opposeShares,
        supportRatio: Math.round(supportRatio * 10) / 10,
        stakerCount,
        rank: 0,
        level: getLevel(score),
      })
    }
  }

  const agents = Array.from(agentMap.values())
  agents.sort((a, b) => b.domainScore - a.domainScore)
  agents.forEach((agent, i) => { agent.rank = i + 1 })

  return agents
}
