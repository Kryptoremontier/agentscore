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
    positions_aggregate?: { aggregate: { sum: { shares: string } | null } }
    /** Live stakers (lib/live-position.ts). Unknown/unread sorts as 0. */
    liveStakerCount?: number | null
  }
  trust: { score: number }
  /**
   * Does this row have a measured score (lib/score-basis.ts hasMeasuredScore:
   * support + oppose stake > 0)? When provided it decides the group instead of
   * the staker count — a zero-share position counts as a "staker" but its score
   * is only the 50 prior, which must not rank among measured scores.
   */
  measured?: boolean
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
      return (b.agent.liveStakerCount ?? 0) - (a.agent.liveStakerCount ?? 0)
    case 'stake':
      return Number(
        BigInt(b.agent.positions_aggregate?.aggregate?.sum?.shares || '0')
        - BigInt(a.agent.positions_aggregate?.aggregate?.sum?.shares || '0')
      )
    default:
      return 0
  }
}

/**
 * Does this entry rank among scored entries? Uses the precomputed `measured`
 * flag when the caller supplies it (/agents does); otherwise falls back to
 * "at least one live staker" (the original Etap 2c gate, minus 0-share rows).
 */
export function hasStake(entry: SortableAgentEntry): boolean {
  if (entry.measured !== undefined) return entry.measured
  return (entry.agent.liveStakerCount ?? 0) > 0
}
