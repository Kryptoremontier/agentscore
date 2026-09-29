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
import { fetchVaultPositions, sumSharesByVault, type VaultPosition, type VaultPositionWithMeta } from './vault-positions'
import { countLiveStakers } from './live-position'
import { summarizeAttesters } from './agent-profile'
import { calculateAgentTier, type AgentTierResult, type AgentTierDisplay } from './agent-tier'
import type { AttestedEntry } from './attestation-reader'
import type { QualityBucket } from './score-basis'

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
  /** The trust triple (its own vault `term_id`, and its counter-vault). Read by the list with the row. */
  as_subject_triples?: Array<{ counter_term_id: string; term_id?: string }> | null
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
  /**
   * Every position on the atom vault + trust counter-vault, as the list read them (with meta), and
   * when (epoch ms). The modal opens on these instead of re-reading them (listVaultSnapshot).
   * null = the list's positions read failed; undefined = never read (cohort rows).
   */
  __vaultPositions?: VaultPositionWithMeta[] | null
  __vaultReadAt?: number
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
        ) { term_id counter_term_id }
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
    // withMeta: the same request, and the modal's backers table can open on these rows.
    const positions = await fetchVaultPositions([...rows.map(a => a.term_id), ...counterTermIds], { withMeta: true }).catch(() => null)
    attachVaultSnapshot(rows, positions, Date.now())
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
export function annotateVaultReads<T extends VaultAnnotatedRow>(
  rows: T[],
  positions: VaultPosition[] | null,
  opts: {
    stakers: boolean
    /** Where the row's counter-vault id lives. Default: its trust triple (`as_subject_triples[0]`);
     *  a claim (a triple itself) carries it as `counter_term_id`. */
    counterOf?: (row: T) => string | null | undefined
  },
): void {
  const sums = positions ? sumSharesByVault(positions) : null
  for (const row of rows) {
    const ctid = (opts.counterOf ? opts.counterOf(row) : row.as_subject_triples?.[0]?.counter_term_id) ?? null
    if (!sums) {
      if (ctid) row.__opposeWei = null
      if (opts.stakers) row.liveStakerCount = null
      continue
    }
    if (ctid && sums.has(ctid)) row.__opposeWei = sums.get(ctid) || 0n
    if (opts.stakers) row.liveStakerCount = countLiveStakers(positions!, { atomId: row.term_id, counterId: ctid })
  }
}

/**
 * Annotate list rows from one read of their vaults (annotateVaultReads: oppose, live stakers) and
 * keep each row's own positions and the read's time, for the modal to open on (listVaultSnapshot).
 * `positions` null = the read failed: every row's snapshot is null (the modal reads it itself).
 */
export function attachVaultSnapshot<T extends AgentListAtom>(rows: T[], positions: VaultPositionWithMeta[] | null, readAt: number): void {
  annotateVaultReads(rows, positions, { stakers: true })
  for (const row of rows) {
    const ctid = row.as_subject_triples?.[0]?.counter_term_id ?? null
    row.__vaultPositions = positions ? positions.filter(p => p.term_id === row.term_id || (!!ctid && p.term_id === ctid)) : null
    row.__vaultReadAt = readAt
  }
}

// ─── What the modal reuses from the list (Etap 4b-cache) ─────────────────────

/**
 * The trust triple of a list row, as the list read it — so the modal needn't look it up
 * (FindTrustTriple). undefined = the list didn't read it (cohort rows, older shapes): look it up.
 * `{ termId: null, counterTermId: null }` = read, and the agent has no trust triple.
 */
export function listTrustTriple(row: Pick<AgentListAtom, 'as_subject_triples'>): { termId: string | null; counterTermId: string | null } | undefined {
  const t = row.as_subject_triples
  if (!Array.isArray(t)) return undefined
  if (t.length === 0) return { termId: null, counterTermId: null }
  if (!t[0]?.term_id) return undefined
  return { termId: t[0].term_id, counterTermId: t[0].counter_term_id ?? null }
}

/**
 * The positions the list read for this row (atom + counter-vault) and when; null when the list
 * didn't read them or the read failed — the modal then reads them itself.
 */
export function listVaultSnapshot(row: Pick<AgentListAtom, '__vaultPositions' | '__vaultReadAt'>): { positions: VaultPositionWithMeta[]; readAt: number } | null {
  if (!row.__vaultPositions || row.__vaultReadAt == null) return null
  return { positions: row.__vaultPositions, readAt: row.__vaultReadAt }
}

/**
 * Oppose shares for the modal's score, from the list's read: the counter-vault's sum (0n when it
 * holds no position). undefined = the list didn't read the vaults (or failed): read them.
 */
export function listOpposeWei(row: Pick<AgentListAtom, '__vaultPositions' | '__opposeWei'>): bigint | undefined {
  if (!row.__vaultPositions) return undefined
  return row.__opposeWei ?? 0n
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
  const totals = corpusTotals(input)
  const segs: string[] = []

  segs.push(totals.agentscore != null ? `${totals.agentscore} AgentScore` : a.status === 'error' ? 'AgentScore feed unavailable' : '— AgentScore')
  segs.push(totals.erc8004 != null ? `${totals.erc8004} ERC-8004` : c.status === 'error' ? 'ERC-8004 feed unavailable' : '— ERC-8004')

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

// ─── Origin tabs, quality filter, URL state (Etap 4b-finish commit 5) ────────

export type OriginFilter = 'all' | 'agentscore' | 'erc8004'
export type QualityFilter = 'all' | QualityBucket

export const ORIGIN_TABS: ReadonlyArray<{ id: OriginFilter; label: string; title: string }> = [
  { id: 'all', label: 'All', title: 'All agents' },
  { id: 'agentscore', label: 'AgentScore', title: 'Agents registered via AgentScore' },
  { id: 'erc8004', label: 'ERC-8004', title: 'Real agents from the ERC-8004 registry cohort — self-declared, not yet attested' },
]

/** The quality buckets, best first; "Unrated" = no measured score (lib/score-basis.ts qualityBucket). */
export const QUALITY_LEVELS: ReadonlyArray<{ id: QualityBucket; label: string }> = [
  { id: 'excellent', label: 'Excellent' },
  { id: 'good', label: 'Good' },
  { id: 'moderate', label: 'Moderate' },
  { id: 'low', label: 'Low' },
  { id: 'critical', label: 'Critical' },
  { id: 'unrated', label: 'Unrated' },
]

/**
 * Corpus sizes — the header segments and the origin tabs both print these (one source).
 * null: that corpus is still loading or its read failed (never a 0 it didn't measure);
 * "All" is known only when both are.
 */
export function corpusTotals(input: {
  agentScore: AgentScoreCorpusCounts
  cohort: CohortCorpusCounts
}): Record<OriginFilter, number | null> {
  const agentscore = input.agentScore.status === 'ok' ? input.agentScore.kept : null
  const erc8004 = input.cohort.status === 'ok' ? input.cohort.count : null
  return { all: agentscore != null && erc8004 != null ? agentscore + erc8004 : null, agentscore, erc8004 }
}

export interface QualityOption {
  id: QualityFilter
  label: string
  /** null = the rows aren't read yet (no count is printed). */
  count: number | null
  /** A bucket with no rows stays listed, disabled with its 0 — nothing silently disappears. */
  disabled: boolean
}

/**
 * The quality dropdown: "All" plus every bucket, always. Counts are over the rows the list
 * would show with no quality filter (origin and search applied), so each option says how
 * many rows choosing it leaves. `buckets`: one entry per such row; null while loading.
 */
export function qualityOptions(buckets: readonly QualityBucket[] | null): QualityOption[] {
  const count = (id: QualityBucket) => (buckets ? buckets.filter((b) => b === id).length : null)
  return [
    { id: 'all', label: 'All quality', count: buckets ? buckets.length : null, disabled: false },
    ...QUALITY_LEVELS.map(({ id, label }) => {
      const n = count(id)
      return { id, label, count: n, disabled: n === 0 }
    }),
  ]
}

export function qualityOptionText(o: QualityOption): string {
  return o.count == null ? o.label : `${o.label} (${o.count})`
}

const ORIGIN_IDS = new Set<string>(ORIGIN_TABS.map((o) => o.id))
const QUALITY_IDS = new Set<string>(['all', ...QUALITY_LEVELS.map((l) => l.id)])

/** `?origin=erc8004&quality=unrated` → the list's filters; anything unknown → 'all'. */
export function parseListFilters(params: { get(name: string): string | null }): { origin: OriginFilter; quality: QualityFilter } {
  const origin = params.get('origin')
  const quality = params.get('quality')
  return {
    origin: origin && ORIGIN_IDS.has(origin) ? (origin as OriginFilter) : 'all',
    quality: quality && QUALITY_IDS.has(quality) ? (quality as QualityFilter) : 'all',
  }
}

/**
 * The query string for a filter change, from the current one: `origin` / `quality` set, or
 * removed at their 'all' default; other params kept — except `open`: a filter changes only
 * with the modal closed, and a stale `?open=` would reopen it on the next URL update.
 * Returns '' or a string starting with '?'.
 */
export function listFiltersSearch(current: string, f: { origin: OriginFilter; quality: QualityFilter }): string {
  const params = new URLSearchParams(current)
  params.delete('open')
  if (f.origin === 'all') params.delete('origin')
  else params.set('origin', f.origin)
  if (f.quality === 'all') params.delete('quality')
  else params.set('quality', f.quality)
  const out = params.toString()
  return out ? `?${out}` : ''
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
 * - `loading`: the bulk read is in flight → no text at all; the line keeps its
 *   height with a fixed-height skeleton (CardAttesterLine), so nothing moves when
 *   the read answers.
 * - `unread`: the read failed → no claim at all, the Attest CTA only.
 * - `none`: the read succeeded and found no live attester → "No attestations yet · Attest".
 * - `some`: "{n} attester(s) · {k} domain(s)".
 */
export type CardAttesterLine =
  | { kind: 'loading'; claim: null; cta: false }
  | { kind: 'unread'; claim: null; cta: true }
  | { kind: 'none'; claim: string; cta: true }
  | { kind: 'some'; claim: string; cta: false; attesters: number; domains: number }

export const CARD_NO_ATTESTATIONS = 'No attestations yet'

/**
 * One card's view out of the page's bulk-read state: undefined = the read is in flight,
 * null = it failed. A completed read with no entry for this id makes no claim either
 * (null → CTA only) — never an endless loading line, never "No attestations yet".
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
  if (view === undefined) return { kind: 'loading', claim: null, cta: false }
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
 * The attester line a row prints — the grid card and the list row both call this
 * (one helper, REPO_MAP §7 rule 4), so the two views can't disagree.
 * `views`: the page's bulk read (undefined = in flight, null = failed).
 */
export function attesterLineOf(
  views: ReadonlyMap<string, CardAttestationView> | null | undefined,
  termId: string,
): CardAttesterLine {
  return cardAttesterLine(cardViewFor(views, termId))
}

/**
 * The tier chip a row shows next to its name: Trusted / Verified only (thesis §6);
 * Unverified is the default state, carried by the attester line. null while the read
 * is in flight, when it failed, and at Unverified. Grid card and list row both call it.
 */
export function tierChipOf(
  views: ReadonlyMap<string, CardAttestationView> | null | undefined,
  termId: string,
): AgentTierDisplay | null {
  const tier = cardViewFor(views, termId)?.tier
  return tier && tier.tier !== 'unverified' ? tier.display : null
}

/**
 * Compact card: name, origin, tier chip (Trusted/Verified only) and the attester
 * line — no score slot, caption, stake line, bar or shield. For a row whose atom
 * vault the list never read (ERC-8004 cohort rows): there the dropped elements are
 * the same on every card ("—", no stake read, an empty bar) and carry nothing about
 * the row (docs/audit/4b-list-findings.md §2).
 *
 * Decided only by what is known at first paint. It used to depend on the attestation
 * read too (a cohort row with an attester got the full card), so Captain Dackie's
 * card grew from 82 to 137 px when that read answered and moved every card below it.
 * Now only the attester line's content changes, inside its reserved height.
 */
export function isCompactCard(input: { vaultRead: boolean }): boolean {
  return !input.vaultRead
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

