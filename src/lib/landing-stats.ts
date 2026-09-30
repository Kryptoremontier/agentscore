/**
 * Landing numbers — one source: /api/v1/stats, i.e. the
 * shared post-junk corpus loader (api-data getPlatformStats → loadAgentCorpus),
 * the same numbers /api/v1/agents meta.total and MCP platform_stats give.
 * Client components go through the API route (CLAUDE.md).
 *
 * The three components used to run their own raw client queries: pre-junk
 * (15 agents where /agents shows 9), silently capped at 250 rows, "Active
 * Stakers" = position rows including 0-share ones, and "Attestations" =
 * position rows + every triple with an agent subject (59 live — a sum of two
 * unrelated counts). "Attestations" is now "Attesters": distinct wallets with a
 * live attestation (commit 1's rule, summarizeAttesters).
 *
 * Loading and failure are their own states — never a 0 (REPO_MAP §7 rule 5).
 */

import { PEOPLE_HERE_UNREAD } from './people-copy'

export interface LandingStats {
  /** Post-junk AgentScore agents (= /api/v1/agents meta.total). */
  agents: number
  /** The corpus read hit our cap: `agents` is a lower bound. null = unknown (also shown as a lower bound). */
  agentsTruncated: boolean | null
  /** Distinct live attester wallets; null = that read failed. */
  attesters: number | null
  /** tTRUST on the kept agents' atom vaults. */
  totalStaked: number
  /** Distinct wallets with a live position on a kept agent's atom or trust counter-vault. */
  activeStakers: number
}

export type LandingStatsState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ok'; stats: LandingStats }

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)

/** /api/v1/stats body → LandingStats, or null when it isn't a successful, complete answer. */
export function parseLandingStats(body: unknown): LandingStats | null {
  const b = body as { success?: boolean; data?: Record<string, unknown> } | null
  const d = b?.success ? b.data : null
  if (!d || !isNum(d.agents) || !isNum(d.totalStaked) || !isNum(d.activeStakers)) return null
  return {
    agents: d.agents,
    agentsTruncated: typeof d.agentsTruncated === 'boolean' ? d.agentsTruncated : null,
    attesters: isNum(d.attesters) ? d.attesters : null,
    totalStaked: d.totalStaked,
    activeStakers: d.activeStakers,
  }
}

// Every landing reader mounting at once shares one request.
let inflight: Promise<LandingStats | null> | null = null

/** null = the read failed (network, non-2xx, or an incomplete body). */
export function fetchLandingStats(apiBase = ''): Promise<LandingStats | null> {
  if (!inflight) {
    inflight = fetch(`${apiBase}/api/v1/stats`)
      .then(async (res) => (res.ok ? parseLandingStats(await res.json()) : null))
      .catch(() => null)
      .finally(() => { inflight = null })
  }
  return inflight
}

/**
 * The landing's one number (Etap 5b Run 2): distinct live people who vouch, from /api/v1/stats.
 * null while loading or when unknown — "—", never 0; `unavailable` says why when the read failed.
 */
export function landingPeopleNumber(state: LandingStatsState): { value: number | null; unavailable: string | null } {
  if (state.status === 'error') return { value: null, unavailable: PEOPLE_HERE_UNREAD }
  if (state.status === 'loading') return { value: null, unavailable: null }
  return { value: state.stats.attesters, unavailable: state.stats.attesters == null ? PEOPLE_HERE_UNREAD : null }
}
