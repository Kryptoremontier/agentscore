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
  const served = parts.filter((p) => p.status === 'ok')
  if (served.length === 0) return null
  const stale = served.filter((p) => partIsStale(p, now))
  if (stale.length === 0) return liveLabel
  return updatedAgoLabel(Math.max(...stale.map((p) => partAgeSeconds(p, now) ?? 0)))
}

/** The page's error when nothing could be read and nothing is cached — for humans. */
export const FEED_UNREACHABLE = 'Can’t reach the Intuition network right now. Try again in a minute.'
