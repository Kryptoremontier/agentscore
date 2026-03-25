/**
 * Contextual Trust Scoring — per-skill trust breakdown.
 *
 * Instead of one global AGENTSCORE, calculates a trust score per skill
 * based on the vault of each [Agent] [hasAgentSkill] [Skill] triple.
 *
 * Overall AGENTSCORE = weighted average of skill scores,
 * where weight = total stake in skill triple vault.
 *
 * Agent with no skills → AGENTSCORE as before (backward compatible).
 */

import { calculateHybridScore } from './hybrid-trust'
import { calculateTrustScoreFromStakes } from './trust-score-engine'

export interface SkillTrustScore {
  skillName: string
  skillAtomId: string
  tripleId: string
  score: number          // 0-100, same algorithm as AGENTSCORE
  supportShares: bigint  // in wei
  opposeShares: bigint   // in wei
  supportRatio: number   // 0-100%
  stakerCount: number
  level: string          // excellent/good/moderate/low/critical
}

export interface SkillBreakdownResult {
  skills: SkillTrustScore[]
  overallScore: number   // weighted average
  hasSkills: boolean     // false = use legacy AGENTSCORE
}

export interface SkillTripleInput {
  id: string
  predicate: { label: string }
  object: { id: string; label: string }
  vault?: {
    totalShares: string
    currentSharePrice: string
    positionCount: number
  } | null
  counterVault?: {
    totalShares: string
    currentSharePrice: string
    positionCount: number
  } | null
}

/**
 * Calculate trust score for each skill triple of an agent.
 *
 * @param triples - Agent's triples (filtered internally to hasAgentSkill)
 * @returns Skill breakdown + weighted overall score
 */
export function calculateSkillBreakdown(
  triples: SkillTripleInput[]
): SkillBreakdownResult {
  // Filter to skill triples only
  const skillTriples = triples.filter(t =>
    t.predicate?.label === 'hasAgentSkill' ||
    t.predicate?.label === 'has-agent-skill' ||
    t.predicate?.label === 'isTrustedFor'  // backward compat
  )

  if (skillTriples.length === 0) {
    return { skills: [], overallScore: 0, hasSkills: false }
  }

  const skills: SkillTrustScore[] = skillTriples.map(triple => {
    let supportShares = 0n
    let opposeShares = 0n
    try { supportShares = BigInt(triple.vault?.totalShares || '0') } catch { supportShares = 0n }
    try { opposeShares = BigInt(triple.counterVault?.totalShares || '0') } catch { opposeShares = 0n }

    const totalShares = supportShares + opposeShares
    const supportRatio = totalShares > 0n
      ? Number((supportShares * 100n) / totalShares)
      : 50

    const trustResult = calculateTrustScoreFromStakes(supportShares, opposeShares)

    // Use hybrid score algorithm — composite = trust score as placeholder
    // (full composite needs time-weighted signals which aren't available per-triple)
    const score = calculateHybridScore(
      trustResult.score,
      trustResult.score,
      supportRatio
    )

    const stakerCount =
      (triple.vault?.positionCount || 0) +
      (triple.counterVault?.positionCount || 0)

    return {
      skillName: cleanSkillName(triple.object?.label || 'Unknown'),
      skillAtomId: triple.object?.id || '',
      tripleId: triple.id,
      score,
      supportShares,
      opposeShares,
      supportRatio,
      stakerCount,
      level: getSkillLevel(score),
    }
  })

  // Sort by score descending
  skills.sort((a, b) => b.score - a.score)

  // Weighted average: weight = total stake per skill triple vault
  const totalWeight = skills.reduce(
    (sum, s) => sum + Number(s.supportShares + s.opposeShares),
    0
  )

  const overallScore =
    totalWeight > 0
      ? skills.reduce((sum, s) => {
          const weight = Number(s.supportShares + s.opposeShares)
          return sum + s.score * weight
        }, 0) / totalWeight
      : skills.reduce((sum, s) => sum + s.score, 0) / skills.length // equal weight if no stake

  return {
    skills,
    overallScore: Math.round(overallScore * 10) / 10,
    hasSkills: true,
  }
}

function cleanSkillName(label: string): string {
  // Strip repeated prefixes like "Skill:INTU: Name - description"
  let result = label.trim()
  const prefixRe = /^(INTU:|Skill:|Agent:)\s*/i
  while (prefixRe.test(result)) {
    result = result.replace(prefixRe, '').trim()
  }
  // If label has format "Name - description", return just the Name part
  const dashIdx = result.indexOf(' - ')
  if (dashIdx > 0) result = result.slice(0, dashIdx)
  return result
}

function getSkillLevel(score: number): string {
  if (score >= 80) return 'excellent'
  if (score >= 60) return 'good'
  if (score >= 40) return 'moderate'
  if (score >= 20) return 'low'
  return 'critical'
}
