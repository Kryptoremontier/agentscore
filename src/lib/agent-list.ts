/**
 * /agents list — the rows the page consumes and the numbers it prints about
 * them. One source per number:
 *
 * - The rows are the shared server corpus (lib/api-data.ts loadAgentCorpus,
 *   the same read as REST and MCP), served to the page by /api/v1/agents/page
 *   (lib/agents-page-data.ts, Etap 4c) with its truncation and total (REPO_MAP
 *   §7 rule 1). The page used to read its own copy from the browser.
 * - The header prints CORPUS totals: fetched once, never search-dependent.
 * - The results line prints the FILTERED count (search + origin + quality).
 *
 * Search is applied client-side to both corpora with one rule
 * (matchesAgentSearch), so the AgentScore and ERC-8004 segments can't drift
 * apart the way the old server-side `_ilike` re-query (AgentScore only,
 * label-only, blind to JSON-labelled atoms) did.
 */

import { sumSharesByVault, type VaultPosition, type VaultPositionWithMeta } from './vault-positions'
import { countLiveStakers } from './live-position'
import { summarizeAttesters } from './agent-profile'
import { calculateAgentTier, type AgentTierResult, type AgentTierDisplay } from './agent-tier'
import type { AttestedEntry } from './attestation-reader'
import type { QualityBucket } from './score-basis'
import { NOBODY_VOUCHES, peopleLine, ERC8004_TAB_TITLE, ALL_BACKING_LEVELS } from './people-copy'
import { stakeReadingOf, hasMeasuredScore } from './score-basis'
import { calculateTrustScoreFromStakes } from './trust-score-engine'
import { compareAgentEntries, parseSort, type AgentListSortBy, type SortableAgentEntry, type VouchCount } from './agent-list-sort'

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

/**
 * A list row updated from a live read of its vaults — right after the user's own trade, so the
 * card and the modal show it at once even while the cached list is older (Etap 4c): atom-vault
 * support shares, oppose shares, live stakers and the modal's snapshot, all from `positions`.
 */
export function withLiveVault<T extends AgentListAtom>(row: T, positions: readonly VaultPositionWithMeta[], readAt: number): T {
  const next: T = { ...row, __opposeWei: undefined }
  const support = sumSharesByVault(positions).get(row.term_id) ?? 0n
  next.positions_aggregate = { aggregate: { ...(row.positions_aggregate?.aggregate ?? {}), sum: { shares: support.toString() } } }
  attachVaultSnapshot([next], [...positions], readAt)
  return next
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

/** "1 agent" / "273 agents" — lib/plural.ts, re-exported for the list's callers. */
export { pluralize } from './plural'

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
 * missing segment. "GraphQL live feed" is claimed only when both reads succeeded and
 * neither is stale; stale data says how old it is instead ("Updated 3 min ago").
 */
export function agentListHeaderSegments(input: {
  agentScore: AgentScoreCorpusCounts
  cohort: CohortCorpusCounts
  /**
   * The freshness line (lib/agents-page-types.ts feedFreshnessLabel): "Updated N min ago" when
   * what is shown is older than it should be (the indexer is failing and the page shows our last
   * complete read). Omitted or the live label = live.
   */
  freshness?: string | null
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
  if (input.freshness && input.freshness !== LIVE_FEED_LABEL) segs.push(input.freshness)
  else if (a.status === 'ok' && c.status === 'ok') segs.push(LIVE_FEED_LABEL)
  return segs
}

// ─── Origin tabs, quality filter, URL state (Etap 4b-finish commit 5) ────────

export type OriginFilter = 'all' | 'agentscore' | 'erc8004'
export type QualityFilter = 'all' | QualityBucket

export const ORIGIN_TABS: ReadonlyArray<{ id: OriginFilter; label: string; title: string }> = [
  { id: 'all', label: 'All', title: 'All agents' },
  { id: 'agentscore', label: 'AgentScore', title: 'Agents registered via AgentScore' },
  { id: 'erc8004', label: 'ERC-8004', title: ERC8004_TAB_TITLE },
]

/** The backing-level buckets (the backing score's; were "quality"), best first; "Unrated" = no measured score (lib/score-basis.ts qualityBucket). */
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
 * The backing-level dropdown (was "quality"): "All" plus every bucket, always. Counts are over the rows the list
 * would show with no quality filter (origin and search applied), so each option says how
 * many rows choosing it leaves. `buckets`: one entry per such row; null while loading.
 */
export function qualityOptions(buckets: readonly QualityBucket[] | null): QualityOption[] {
  const count = (id: QualityBucket) => (buckets ? buckets.filter((b) => b === id).length : null)
  return [
    { id: 'all', label: ALL_BACKING_LEVELS, count: buckets ? buckets.length : null, disabled: false },
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

/**
 * `?origin=erc8004&quality=unrated&sort=newest` → the list's filters; an unknown filter → 'all',
 * a missing or unknown sort → "Most vouched" (lib/agent-list-sort.ts parseSort).
 */
export function parseListFilters(params: { get(name: string): string | null }): { origin: OriginFilter; quality: QualityFilter; sort: AgentListSortBy } {
  const origin = params.get('origin')
  const quality = params.get('quality')
  return {
    origin: origin && ORIGIN_IDS.has(origin) ? (origin as OriginFilter) : 'all',
    quality: quality && QUALITY_IDS.has(quality) ? (quality as QualityFilter) : 'all',
    sort: parseSort(params.get('sort')),
  }
}

/**
 * The query string for a filter change, from the current one: `origin` / `quality` set, or
 * removed at their 'all' default; `sort` set when given — the default too, so a chosen
 * "Most vouched" stays in the URL (`?sort=vouched`) — and kept as it is otherwise; other params
 * kept — except `open`: a filter changes only with the modal closed, and a stale `?open=` would
 * reopen it on the next URL update. Returns '' or a string starting with '?'.
 */
export function listFiltersSearch(current: string, f: { origin: OriginFilter; quality: QualityFilter; sort?: AgentListSortBy }): string {
  const params = new URLSearchParams(current)
  params.delete('open')
  if (f.origin === 'all') params.delete('origin')
  else params.set('origin', f.origin)
  if (f.quality === 'all') params.delete('quality')
  else params.set('quality', f.quality)
  if (f.sort) params.set('sort', f.sort)
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
  /** The attested domains' labels, in read order — the line names the area when there is one. */
  areas: string[]
  /** tTRUST (wei) behind the vouches: support stake across every attested domain — the stat row's. */
  stakeWei: bigint
  tier: AgentTierResult
}

export function cardAttestationView(entries: readonly AttestedEntry[]): CardAttestationView {
  const summary = summarizeAttesters(entries)
  return {
    attesters: summary.length,
    domains: entries.length,
    areas: entries.map((e) => e.domain.label),
    stakeWei: entries.reduce((sum, e) => sum + e.totalStake, 0n),
    tier: calculateAgentTier(summary),
  }
}

/**
 * The card's attester line (REPO_MAP §7 rule 5: failed ≠ empty). `claim` is the
 * text the card prints (null = none), `cta` whether the Attest button follows it.
 * - `loading`: the bulk read is in flight → no text at all; the line keeps its
 *   height with a fixed-height skeleton (CardAttesterLine), so nothing moves when
 *   the read answers.
 * - `unread`: the read failed → no claim at all, the Attest CTA only.
 * - `none`: the read succeeded and found no live attester → "Nobody vouches yet · Vouch".
 * - `some`: "1 person vouches · for Knowledge / Productivity" — the area named when there is
 *   one, "for 2 areas" when more (lib/people-copy.ts peopleLine).
 */
export type CardAttesterLine =
  | { kind: 'loading'; claim: null; cta: false }
  | { kind: 'unread'; claim: null; cta: true }
  | { kind: 'none'; claim: string; cta: true }
  | { kind: 'some'; claim: string; cta: false; attesters: number; domains: number }

export const CARD_NO_ATTESTATIONS = NOBODY_VOUCHES

/**
 * One card's view out of the page's bulk-read state: undefined = the read is in flight,
 * null = it failed. A completed read with no entry for this id makes no claim either
 * (null → CTA only) — never an endless loading line, never "Nobody vouches yet".
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
    claim: peopleLine(view.attesters, view.areas),
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

// ─── Order (Etap 5b: people first) ──────────────────────────────────────────

/** Who vouches for one row, for the sort: null = not read (or nobody) — sorts as nobody. */
export function vouchOf(views: ReadonlyMap<string, CardAttestationView> | null | undefined, termId: string): VouchCount | null {
  const v = views?.get(termId)
  return v ? { people: v.attesters, stakeWei: v.stakeWei } : null
}

/** One row's stake reading and backing score as the list derives them (lib/score-basis.ts). */
export function listEntryOf<A extends { term_id: string; positions_aggregate?: AgentListAtom['positions_aggregate']; __opposeWei?: bigint | null }>(agent: A) {
  // supportWei null = the vault was never read (cohort rows); opposeWei null = the
  // oppose read failed — both unknown, never 0 (lib/score-basis.ts stakeReadingOf).
  const reading = stakeReadingOf(agent)
  const measured = hasMeasuredScore(reading)
  // Computed for every row (sort/filter plumbing), displayed only when measured.
  const trust = calculateTrustScoreFromStakes(reading.supportWei ?? 0n, reading.opposeWei ?? 0n)
  return { agent, trust, measured, reading }
}

/**
 * The list's order — /agents and the landing carousel both call this with the same default
 * (lib/agent-list-sort.ts DEFAULT_SORT), so the carousel shows the list's first rows.
 */
export function orderAgents<E extends SortableAgentEntry & { agent: { term_id: string } }>(
  entries: readonly E[],
  views: ReadonlyMap<string, CardAttestationView> | null | undefined,
  sortBy: AgentListSortBy,
): E[] {
  return entries
    .map((e) => ({ ...e, vouch: vouchOf(views, e.agent.term_id) }))
    .sort((a, b) => compareAgentEntries(a, b, sortBy))
}

