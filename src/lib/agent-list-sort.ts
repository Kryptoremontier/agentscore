/**
 * Agent List Sort — Etap 2c honesty gate, extracted from the /agents page's
 * inline comparator so it's unit-testable.
 *
 * Merging the ERC-8004 cohort into the same list as scored AgentScore
 * agents introduced atoms with zero real stakers (a lone self-registration
 * deposit does not count — see project memory erc8004-oasf-recon). Per
 * thesis §6 ("no fake scores"), an unstaked atom must never outrank a
 * genuinely staked agent by raw score alone: `calculateTrustScoreFromStakes`
 * returns a neutral ~50 for zero stake, which would otherwise interleave
 * with real mid-tier scores under `score_desc`/`score_asc`.
 */

export type AgentListSortBy = 'newest' | 'score_desc' | 'score_asc' | 'stakers' | 'stake'

export interface SortableAgentEntry {
  agent: {
    positions_aggregate?: { aggregate: { count: number; sum: { shares: string } | null } }
  }
  trust: { score: number }
}

/**
 * Comparator for the agent list. Sinks entries with zero real stakers below
 * all staked entries first, then applies the requested sort within each
 * group. Pass to `Array.prototype.sort`.
 */
export function compareAgentEntries(
  a: SortableAgentEntry,
  b: SortableAgentEntry,
  sortBy: AgentListSortBy
): number {
  const stakeRank = Number(hasStake(b)) - Number(hasStake(a))
  if (stakeRank !== 0) return stakeRank

  switch (sortBy) {
    case 'score_desc':
      return b.trust.score - a.trust.score
    case 'score_asc':
      return a.trust.score - b.trust.score
    case 'stakers':
      return (b.agent.positions_aggregate?.aggregate?.count || 0)
           - (a.agent.positions_aggregate?.aggregate?.count || 0)
    case 'stake':
      return Number(
        BigInt(b.agent.positions_aggregate?.aggregate?.sum?.shares || '0')
        - BigInt(a.agent.positions_aggregate?.aggregate?.sum?.shares || '0')
      )
    default:
      return 0
  }
}

/** Does this agent have at least one real staker (not just a self-registration deposit)? */
export function hasStake(entry: SortableAgentEntry): boolean {
  return (entry.agent.positions_aggregate?.aggregate?.count || 0) > 0
}
