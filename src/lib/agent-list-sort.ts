/**
 * Agent List Sort — the /agents list's order and the landing carousel's (one comparator, one
 * default: REPO_MAP §7 rule 4).
 *
 * Etap 5b: people first. The default, "Most vouched", ranks by how many distinct people vouch
 * (live attesters), then the tTRUST behind their vouches, then the backing score, then newest.
 * The other two: "Newest" and "Highest backing".
 *
 * Etap 2c honesty gate, kept for the backing sorts: an atom without a measured score never ranks
 * by the 50 prior that `calculateTrustScoreFromStakes` returns at zero stake — it sorts after
 * every measured row ("—" last), never interleaved with real scores.
 */

export type AgentListSortBy = 'vouched' | 'newest' | 'backing'

export const DEFAULT_SORT: AgentListSortBy = 'vouched'

export const SORT_OPTIONS: ReadonlyArray<{ id: AgentListSortBy; label: string }> = [
  { id: 'vouched', label: 'Most vouched' },
  { id: 'newest', label: 'Newest' },
  { id: 'backing', label: 'Highest backing' },
]

const SORT_IDS = new Set<string>(SORT_OPTIONS.map((o) => o.id))

/** `?sort=` → the list's sort; missing or unknown → the default ("Most vouched"). */
export function parseSort(value: string | null | undefined): AgentListSortBy {
  return value && SORT_IDS.has(value) ? (value as AgentListSortBy) : DEFAULT_SORT
}

/** Who vouches for one agent: distinct live attesters and the tTRUST (wei) behind their vouches. */
export interface VouchCount {
  people: number
  stakeWei: bigint
}

export interface SortableAgentEntry {
  agent: {
    created_at?: string
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
  /** Who vouches (lib/agent-list.ts vouchOf). null/undefined = not read or nobody: sorts as nobody. */
  vouch?: VouchCount | null
}

/** The backing score a row prints, or null ("—": no measurement). */
export function backingOf(entry: SortableAgentEntry): number | null {
  return hasStake(entry) ? entry.trust.score : null
}

const newestFirst = (a: SortableAgentEntry, b: SortableAgentEntry) =>
  (Date.parse(b.agent.created_at ?? '') || 0) - (Date.parse(a.agent.created_at ?? '') || 0)

/** Higher backing first; a row without a measured score after every measured one. */
const backingFirst = (a: SortableAgentEntry, b: SortableAgentEntry) => {
  const x = backingOf(a)
  const y = backingOf(b)
  if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1
  return y - x
}

const vouchedFirst = (a: SortableAgentEntry, b: SortableAgentEntry) => {
  const people = (b.vouch?.people ?? 0) - (a.vouch?.people ?? 0)
  if (people !== 0) return people
  const x = a.vouch?.stakeWei ?? 0n
  const y = b.vouch?.stakeWei ?? 0n
  return y > x ? 1 : y < x ? -1 : 0
}

/** Comparator for the agent list. Pass to `Array.prototype.sort`. */
export function compareAgentEntries(a: SortableAgentEntry, b: SortableAgentEntry, sortBy: AgentListSortBy): number {
  switch (sortBy) {
    case 'vouched':
      return vouchedFirst(a, b) || backingFirst(a, b) || newestFirst(a, b)
    case 'backing':
      return backingFirst(a, b) || newestFirst(a, b)
    case 'newest':
    default:
      return newestFirst(a, b)
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
