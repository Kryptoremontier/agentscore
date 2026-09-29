/**
 * The /agents page's API contract (Etap 4c) — types and pure helpers shared by the server
 * (lib/agents-page-data.ts, app/api/v1/agents/page) and the page. Browser-safe: no I/O.
 *
 * An answer is made of PARTS, each read through the shared complete-reads cache on its own:
 * a part is either served with the age of its data, or failed (no value was ever read, or none
 * is left). A failed part is never an empty list standing in for a failure (REPO_MAP §7 rule 5),
 * and a part served from an old read always says how old it is (rule 6).
 */

import type { AttestedEntry } from './attestation-reader'
import type { AgentListAtom } from './agent-list'
import type { CohortAgent } from './cohort-reader'
import type { VaultPositionWithMeta } from './vault-positions'
import type { AgentSignals } from './agent-signals'
import type { AgentReport } from './agent-profile'
import type { fetchAgentSkillTriples } from './intuition'

export type PagePart<T> =
  | {
      status: 'ok'
      value: T
      /** When the oldest read behind this part hit the indexer (absolute: a CDN hop can't hide it). */
      dataReadAt: string
      /** Age when the server built the answer; the page recomputes it from dataReadAt. */
      dataAgeSeconds: number
      /** false = some read behind it was incomplete (e.g. tiers unread); its unknowns say so. */
      complete: boolean
      /** Older than this and the part was not re-read when it should have been: the indexer is failing. */
      staleAfterSeconds: number
    }
  | { status: 'failed' }

/** GET /api/v1/agents/page */
export interface AgentsPagePayload {
  /** The AgentScore corpus: post-junk rows as the list consumes them, with their vault snapshot. */
  agentScore: PagePart<{
    rows: AgentListAtom[]
    /** Junk-filtered rows among the fetched ones (agent-junk-filter.ts). */
    junk: number
    /** Raw rows fetched (pre-junk). */
    fetched: number
    total: number | null
    truncated: boolean | null
    /** term_id → attestation entries for every corpus row; null = that read failed (tiers unknown). */
    attestations: Record<string, AttestedEntry[]> | null
  }>
  /** The ERC-8004 cohort (identity links + declarations). */
  cohort: PagePart<{ agents: CohortAgent[]; total: number | null; truncated: boolean | null }>
  /** term_id → attestation entries for every cohort agent. Failed whenever the cohort is. */
  cohortAttestations: PagePart<Record<string, AttestedEntry[]>>
}

/** GET /api/v1/agents/page/:id — what the modal reads beyond the list, for one agent. */
export interface AgentModalPayload {
  /** The trust triple (null = the agent has none) and every position on its vaults (raw, with meta). */
  vault: PagePart<{ trustTriple: { termId: string; counterTermId: string | null } | null; positions: VaultPositionWithMeta[] }>
  /** Newest signals on the atom vault + counter-vault, and their total. Failed whenever the vault is. */
  signals: PagePart<AgentSignals>
  /** The agent's skill triples with their stake (the skill breakdown and the Timeline's skill events). */
  skillTriples: PagePart<Awaited<ReturnType<typeof fetchAgentSkillTriples>>>
  reports: PagePart<AgentReport[]>
  /** Evaluator weight (0.5x–1.5x) per staker wallet, lowercased; its first 20 live stakers. */
  stakerWeights: PagePart<Record<string, number>>
}

/** A part's age now, from its absolute read time (never negative). null when it failed. */
export function partAgeSeconds(part: PagePart<unknown>, now: number = Date.now()): number | null {
  if (part.status !== 'ok') return null
  const readAt = Date.parse(part.dataReadAt)
  return Number.isFinite(readAt) ? Math.max(0, Math.floor((now - readAt) / 1000)) : part.dataAgeSeconds
}

/** Served, but older than the cache ever serves while the indexer answers. */
export function partIsStale(part: PagePart<unknown>, now: number = Date.now()): boolean {
  const age = partAgeSeconds(part, now)
  return age != null && part.status === 'ok' && age > part.staleAfterSeconds
}

/** "Updated just now" / "Updated 3 min ago" / "Updated 2 h ago" / "Updated 1 day ago". */
export function updatedAgoLabel(ageSeconds: number): string {
  if (ageSeconds < 60) return 'Updated just now'
  const min = Math.floor(ageSeconds / 60)
  if (min < 60) return `Updated ${min} min ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `Updated ${h} h ago`
  const d = Math.floor(h / 24)
  return `Updated ${d} day${d === 1 ? '' : 's'} ago`
}

/**
 * The page's freshness line, from the parts that were served: "GraphQL live feed" when every
 * served part is within its normal age, else "Updated N min ago" from the OLDEST stale part
 * (plain language — the reader wants to know how old what they see is, not why). null when no
 * part was served (the page shows its error instead).
 */
export function feedFreshnessLabel(parts: ReadonlyArray<PagePart<unknown>>, liveLabel: string, now: number = Date.now()): string | null {
  if (!parts.some((p) => p.status === 'ok')) return null
  return staleAgeLabel(parts, now) ?? liveLabel
}

/** "Updated N min ago" from the oldest stale part; null when none is stale. */
function staleAgeLabel(parts: ReadonlyArray<PagePart<unknown>>, now: number): string | null {
  const stale = parts.filter((p) => partIsStale(p, now))
  return stale.length ? updatedAgoLabel(Math.max(...stale.map((p) => partAgeSeconds(p, now) ?? 0))) : null
}

/** The page's error when nothing could be read and nothing is cached — for humans. */
export const FEED_UNREACHABLE = 'Can’t reach the Intuition network right now. Try again in a minute.'

/**
 * What the list renders from one page answer. `null` payload = our own API couldn't be reached:
 * every part failed. A corpus that failed is status 'error' with no rows (never an empty corpus);
 * attestations merge what was read — a subject whose part failed is absent (the card makes no
 * claim, lib/agent-list.ts cardViewFor), and null when neither part was read.
 */
export interface AgentsPageView {
  agentScore:
    | { status: 'ok'; rows: AgentListAtom[]; junk: number; fetched: number; total: number | null; truncated: boolean | null }
    | { status: 'error' }
  cohort: { status: 'ok'; agents: CohortAgent[]; total: number | null; truncated: boolean | null } | { status: 'error' }
  attestations: Map<string, AttestedEntry[]> | null
  /** The parts that were served, for the freshness line. */
  parts: Array<PagePart<unknown>>
  /** Nothing at all could be read and nothing was cached: the page's error. */
  unreachable: boolean
}

export function agentsPageView(payload: AgentsPagePayload | null): AgentsPageView {
  const a = payload?.agentScore ?? { status: 'failed' as const }
  const c = payload?.cohort ?? { status: 'failed' as const }
  const ca = payload?.cohortAttestations ?? { status: 'failed' as const }
  const read: Array<Record<string, AttestedEntry[]>> = []
  if (a.status === 'ok' && a.value.attestations) read.push(a.value.attestations)
  if (ca.status === 'ok') read.push(ca.value)
  return {
    agentScore: a.status === 'ok'
      ? { status: 'ok', rows: a.value.rows, junk: a.value.junk, fetched: a.value.fetched, total: a.value.total, truncated: a.value.truncated }
      : { status: 'error' },
    cohort: c.status === 'ok' ? { status: 'ok', ...c.value } : { status: 'error' },
    attestations: read.length ? new Map(read.flatMap((r) => Object.entries(r))) : null,
    parts: [a, c, ca].filter((p) => p.status === 'ok'),
    unreachable: a.status !== 'ok' && c.status !== 'ok',
  }
}

/**
 * The modal's age line — it covers the list's header on a phone, so it says the age itself:
 * "Updated N min ago" when anything it shows (the list's parts: row, tier, attestations; its own
 * parts) is older than the cache serves while the indexer answers; null otherwise. After the
 * user's own trade its vault, signals and reports are read live, so they don't count.
 */
export function modalFreshnessLabel(
  list: Pick<AgentsPageView, 'parts'> | null,
  modal: AgentModalPayload | null,
  liveAfterOwnTx: boolean,
  now: number = Date.now(),
): string | null {
  const own = !modal ? [] : liveAfterOwnTx ? [modal.skillTriples, modal.stakerWeights] : Object.values(modal)
  return staleAgeLabel([...(list?.parts ?? []), ...own], now)
}

/** The modal answer when our own API couldn't be reached: every part unknown. */
export const MODAL_UNREACHABLE: AgentModalPayload = {
  vault: { status: 'failed' },
  signals: { status: 'failed' },
  skillTriples: { status: 'failed' },
  reports: { status: 'failed' },
  stakerWeights: { status: 'failed' },
}

/**
 * After the user's own transaction on an agent, that agent's modal reads go straight to the
 * indexer for this long — longer than the cached answers can lag behind it (2 × the 30 s agent
 * TTL + the CDN window) — so they never show the state from before the user's action.
 */
export const OWN_TX_LIVE_MS = 5 * 60_000

export function isLiveAfterOwnTx(liveUntil: Readonly<Record<string, number>>, termId: string, now: number = Date.now()): boolean {
  return (liveUntil[termId] ?? 0) > now
}
