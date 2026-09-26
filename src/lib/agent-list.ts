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
import { fetchVaultPositions, sumSharesByVault, type VaultPosition } from './vault-positions'
import { countLiveStakers } from './live-position'
import { summarizeAttesters } from './agent-profile'
import { calculateAgentTier, type AgentTierResult } from './agent-tier'
import type { AttestedEntry } from './attestation-reader'

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
  /** Atom-vault support stake. The row count is deliberately not read: it counts 0-share rows. */
  positions_aggregate?: { aggregate: { sum: { shares: string } | null } }
  as_subject_triples?: Array<{ counter_term_id: string }> | null
  /**
   * Stakers: distinct wallets with a live position on the atom vault or its trust
   * counter-vault (lib/live-position.ts countLiveStakers). undefined = never read
   * (cohort rows), null = the positions read failed — never a 0 that wasn't measured.
   */
  liveStakerCount?: number | null
  /**
   * Oppose shares on the trust counter-vault. undefined = no counter vault or no
   * oppose position (0); null = the positions read failed — unknown, so the row
   * has no measured score (lib/score-basis.ts), never a score computed from 0 oppose.
   */
  __opposeWei?: bigint | null
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
 * `__opposeWei`, as the cards expect; null when that read failed). Throws on a failed corpus read — the
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

  // One paged read of every position on the atom vaults + trust counter-vaults: oppose shares
  // per counter-vault, and stakers per agent counted with the one live rule (0-share rows are
  // not stakers — they are what `positions_aggregate.count` used to count).
  const counterTermIds = rows
    .map(a => a.as_subject_triples?.[0]?.counter_term_id)
    .filter((id): id is string => !!id)
  if (rows.length > 0) {
    const positions = await fetchVaultPositions([...rows.map(a => a.term_id), ...counterTermIds]).catch(() => null)
    annotateVaultReads(rows, positions, { stakers: true })
  }

  return { rows, total: page.total, truncated: page.truncated }
}

/** The fields annotateVaultReads reads and writes on a list row. */
export interface VaultAnnotatedRow {
  term_id: string
  as_subject_triples?: Array<{ counter_term_id: string | null }> | null
  liveStakerCount?: number | null
  __opposeWei?: bigint | null
}

/**
 * Annotate list rows from ONE positions read of their atom vaults + trust counter-vaults
 * (/agents and the landing Featured cards share it):
 * - `__opposeWei`: the counter-vault's shares (unset when there's no counter-vault or no
 *   oppose position — a real 0).
 * - `liveStakerCount` (opts.stakers): distinct live wallets (lib/live-position.ts).
 * `positions` null = the read FAILED: stakers null and, for every row with a counter-vault,
 * `__opposeWei` null — unknown, never 0 (a failed read taken as 0 oppose inflates the score;
 * lib/score-basis.ts stakeReadingOf keeps it null and hasMeasuredScore says "not measured").
 */
export function annotateVaultReads(rows: VaultAnnotatedRow[], positions: VaultPosition[] | null, opts: { stakers: boolean }): void {
  const sums = positions ? sumSharesByVault(positions) : null
  for (const row of rows) {
    const ctid = row.as_subject_triples?.[0]?.counter_term_id ?? null
    if (!sums) {
      if (ctid) row.__opposeWei = null
      if (opts.stakers) row.liveStakerCount = null
      continue
    }
    if (ctid && sums.has(ctid)) row.__opposeWei = sums.get(ctid) || 0n
    if (opts.stakers) row.liveStakerCount = countLiveStakers(positions!, { atomId: row.term_id, counterId: ctid })
  }
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

// ─── Attestations on the card ───────────────────────────────────────────────

/**
 * One agent's attestations as a card shows them. Same derivation as the modal
 * (computeModalStatSummary + calculateAgentTier): attesters =
 * summarizeAttesters(entries).length (distinct live wallets across all
 * domains), domains = entries.length (one entry per attested domain; a
 * domain with no live attester has no entry). The list and the modal read
 * the same rows (attestation-reader), so they print the same numbers.
 */
export interface CardAttestationView {
  attesters: number
  domains: number
  tier: AgentTierResult
}

export function cardAttestationView(entries: readonly AttestedEntry[]): CardAttestationView {
  const summary = summarizeAttesters(entries)
  return { attesters: summary.length, domains: entries.length, tier: calculateAgentTier(summary) }
}

/**
 * The card's attester line (REPO_MAP §7 rule 5: failed ≠ empty). `claim` is the
 * text the card prints (null = none), `cta` whether the Attest button follows it.
 * - `loading`: the bulk read is in flight → "— attesters".
 * - `unread`: the read failed → no claim at all, the Attest CTA only.
 * - `none`: the read succeeded and found no live attester → "No attestations yet · Attest".
 * - `some`: "{n} attester(s) · {k} domain(s)".
 */
export type CardAttesterLine =
  | { kind: 'loading'; claim: string; cta: false }
  | { kind: 'unread'; claim: null; cta: true }
  | { kind: 'none'; claim: string; cta: true }
  | { kind: 'some'; claim: string; cta: false; attesters: number; domains: number }

export const CARD_NO_ATTESTATIONS = 'No attestations yet'

/**
 * One card's view out of the page's bulk-read state: undefined = the read is in flight,
 * null = it failed. A completed read with no entry for this id makes no claim either
 * (null → CTA only) — never an endless "— attesters", never "No attestations yet".
 */
export function cardViewFor(
  views: ReadonlyMap<string, CardAttestationView> | null | undefined,
  termId: string,
): CardAttestationView | null | undefined {
  if (views === undefined) return undefined
  if (views === null) return null
  return views.get(termId) ?? null
}

/** `view`: undefined = not read yet, null = the read failed. */
export function cardAttesterLine(view: CardAttestationView | null | undefined): CardAttesterLine {
  if (view === undefined) return { kind: 'loading', claim: '— attesters', cta: false }
  if (view === null) return { kind: 'unread', claim: null, cta: true }
  if (view.attesters === 0) return { kind: 'none', claim: CARD_NO_ATTESTATIONS, cta: true }
  return {
    kind: 'some',
    claim: `${pluralize(view.attesters, 'attester')} · ${pluralize(view.domains, 'domain')}`,
    cta: false,
    attesters: view.attesters,
    domains: view.domains,
  }
}

/**
 * Compact card: name, origin, tier chip (Trusted/Verified only) and the attester
 * line — no score slot, caption, stake line, bar or shield. Only for a row whose
 * atom vault the list never read (ERC-8004 cohort rows) and that is not known to
 * have an attester. For those rows the dropped elements are the same on every
 * card ("—", no stake read, an empty bar): they carry nothing about the row
 * (docs/audit/4b-list-findings.md §2). A row with attesters (Captain Dackie)
 * keeps the full card.
 */
export function isCompactCard(input: { vaultRead: boolean; line: CardAttesterLine }): boolean {
  return !input.vaultRead && input.line.kind !== 'some'
}

/**
 * The card's "Attest" CTA opens the modal scrolled to ATTESTED — but only once the
 * profile has loaded (the section's height depends on it). 'idle' = nothing pending
 * (or the modal closed: drop the request), 'wait' = pending, 'scroll' = do it now.
 */
export function attestScrollStep(s: { modalOpen: boolean; requested: boolean; profileLoaded: boolean }): 'idle' | 'wait' | 'scroll' {
  if (!s.modalOpen || !s.requested) return 'idle'
  return s.profileLoaded ? 'scroll' : 'wait'
}

