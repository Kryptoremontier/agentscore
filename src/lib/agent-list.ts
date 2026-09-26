/**
 * /agents list — the AgentScore corpus read and the numbers the page prints
 * about it. One source per number:
 *
 * - The header prints CORPUS totals: fetched once, never search-dependent.
 * - The results line prints the FILTERED count (search + origin + quality).
 * - A capped fetch reports its own truncation (REPO_MAP §7 rule 1): the rows
 *   are paged to an aggregate count on the SAME `where` (lib/gql-pager.ts),
 *   so neither our cap nor the endpoint's 250-row cap truncates silently.
 *
 * Search is applied client-side to both corpora with one rule
 * (matchesAgentSearch), so the AgentScore and ERC-8004 segments can't drift
 * apart the way the old server-side `_ilike` re-query (AgentScore only,
 * label-only, blind to JSON-labelled atoms) did.
 */

import { AGENT_WHERE_STR } from './gql-filters'
import { fetchAllRows, SERVER_ROW_CAP } from './gql-pager'
import { fetchVaultPositions, sumSharesByVault } from './vault-positions'

/** Cap on the /agents AgentScore fetch. Truncation past it is reported, never silent. */
export const AGENT_LIST_LIMIT = 50

const TRUST_PREDICATE_ID = '0xc5f40275b1a5faf84eea97536c8358352d144729ef3e0e6108d67616f96272ba'

/** Row shape as the /agents page consumes it (indexer fields + client annotations). */
export interface AgentListAtom {
  term_id: string
  label: string
  data?: string | null
  type: string
  created_at: string
  emoji?: string
  creator?: { label: string; id?: string } | null
  positions_aggregate?: { aggregate: { count: number; sum: { shares: string } | null } }
  as_subject_triples?: Array<{ counter_term_id: string }> | null
}

export interface AgentListFetch<T extends AgentListAtom = AgentListAtom> {
  /** Raw rows (pre-junk-filter), created_at desc, at most AGENT_LIST_LIMIT. */
  rows: T[]
  /** Size of the whole corpus (pre-junk): the aggregate, or read to the end; null if unknown. */
  total: number | null
  /** true = rows is a prefix of the corpus; null = unknown (count failed at the cap). */
  truncated: boolean | null
}

/**
 * Fetch the AgentScore corpus for /agents: rows (paged, capped) + a same-filter
 * aggregate count, then oppose shares for the trust triples (annotated as
 * `__opposeWei`, as the cards expect). Throws on a failed corpus read — the
 * page shows its error state; it never renders an empty list for a failure.
 */
export async function fetchAgentListCorpus<T extends AgentListAtom = AgentListAtom>(): Promise<AgentListFetch<T>> {
  const page = await fetchAllRows<T>({
    // created_at ties are common (218 of the newest 250 atoms, live) — term_id makes the order unique.
    query: `
    query AgentListCorpus($limit: Int!, $offset: Int!) {
      atoms(
        where: ${AGENT_WHERE_STR}
        limit: $limit
        offset: $offset
        order_by: [{ created_at: desc }, { term_id: asc }]
      ) {
        term_id
        label
        data
        type
        emoji
        created_at
        creator { label id }
        positions_aggregate {
          aggregate {
            count
            sum { shares }
          }
        }
        as_subject_triples(
          where: { predicate_id: { _eq: "${TRUST_PREDICATE_ID}" } }
          limit: 1
        ) { counter_term_id }
      }
    }
  `,
    field: 'atoms',
    countQuery: `query AgentListCorpusCount { atoms_aggregate(where: ${AGENT_WHERE_STR}) { aggregate { count } } }`,
    countField: 'atoms_aggregate',
    pageSize: SERVER_ROW_CAP.atoms,
    maxRows: AGENT_LIST_LIMIT,
  })
  const rows = page.rows

  // Oppose vault shares for every trust triple — one paged read.
  const counterTermIds = rows
    .map(a => a.as_subject_triples?.[0]?.counter_term_id)
    .filter((id): id is string => !!id)
  if (counterTermIds.length > 0) {
    try {
      const opposeMap = sumSharesByVault(await fetchVaultPositions(counterTermIds))
      for (const atom of rows) {
        const ctid = atom.as_subject_triples?.[0]?.counter_term_id
        if (ctid && opposeMap.has(ctid)) (atom as any).__opposeWei = opposeMap.get(ctid) || 0n
      }
    } catch { /* non-critical: cards fall back to opposeWei = 0 (see audit — known gap) */ }
  }

  return { rows, total: page.total, truncated: page.truncated }
}

// ─── Numbers the page prints ────────────────────────────────────────────────

/** "1 agent" / "273 agents". */
export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

/** One search rule for both corpora: case-insensitive substring of any given field. */
export function matchesAgentSearch(term: string, fields: ReadonlyArray<string | null | undefined>): boolean {
  const q = term.trim().toLowerCase()
  if (!q) return true
  return fields.some(f => !!f && f.toLowerCase().includes(q))
}

/** State of one corpus read. 'error' is never shown as an empty corpus. */
export type FeedStatus = 'loading' | 'ok' | 'error'

export interface AgentScoreCorpusCounts {
  status: FeedStatus
  /** Post-junk rows shown in the list. */
  kept: number
  /** Junk-filtered rows among the fetched ones. */
  junk: number
  /** Raw rows fetched (pre-junk). */
  fetched: number
  total: number | null
  truncated: boolean | null
}

export interface CohortCorpusCounts {
  status: FeedStatus
  /** Distinct cohort agents fetched. */
  count: number
  /** Distinct cohort agents in the registry; null if unknown. */
  total: number | null
  truncated: boolean | null
}

export const LIVE_FEED_LABEL = 'GraphQL live feed'

/**
 * Header segments — CORPUS totals only. Takes no search/filter input on
 * purpose: typing a search must not change the header.
 *
 * A corpus that is still loading prints "—", one that failed prints
 * "… feed unavailable" — never a 0 it didn't measure, and never a silently
 * missing segment. "GraphQL live feed" is claimed only when both reads succeeded.
 */
export function agentListHeaderSegments(input: {
  agentScore: AgentScoreCorpusCounts
  cohort: CohortCorpusCounts
}): string[] {
  const { agentScore: a, cohort: c } = input
  const segs: string[] = []

  segs.push(a.status === 'ok' ? `${a.kept} AgentScore` : a.status === 'error' ? 'AgentScore feed unavailable' : '— AgentScore')
  segs.push(c.status === 'ok' ? `${c.count} ERC-8004` : c.status === 'error' ? 'ERC-8004 feed unavailable' : '— ERC-8004')

  if (a.status === 'ok' && a.junk > 0) segs.push(`${a.junk} hidden`)
  if (a.status === 'ok' && a.truncated && a.total != null) {
    segs.push(`showing first ${a.fetched} of ${a.total} AgentScore atoms`)
  }
  if (c.status === 'ok' && c.truncated && c.total != null) {
    segs.push(`showing first ${c.count} of ${c.total} ERC-8004 agents`)
  }
  if (a.status === 'ok' && c.status === 'ok') segs.push(LIVE_FEED_LABEL)
  return segs
}

/**
 * Results line: the filtered count, "of N" only when a filter narrowed it; the
 * noun agrees with the last number ("1 agent", "1 of 273 agents").
 */
export function agentResultsLine(shown: number, of: number): { shown: number; of: number | null; noun: string } {
  const narrowed = shown !== of
  return { shown, of: narrowed ? of : null, noun: (narrowed ? of : shown) === 1 ? 'agent' : 'agents' }
}
