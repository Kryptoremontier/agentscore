/**
 * Landing numbers (Hero, Stats, CTA) — one source: /api/v1/stats, i.e. the
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

export interface LandingStats {
  /** Post-junk AgentScore agents (= /api/v1/agents meta.total). */
  agents: number
  /** The corpus read hit our cap: `agents` is a lower bound. null = unknown. */
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

// Hero, Stats and CTA mount together: one request between them, not three.
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

export interface LandingStatItem {
  key: 'agents' | 'attesters' | 'totalStaked' | 'activeStakers'
  label: string
  /** null = loading or unknown → the tile prints "—", never 0. */
  value: number | null
  decimals: number
  suffix: string
}

/** The four landing tiles, from one state. */
export function landingStatItems(state: LandingStatsState): LandingStatItem[] {
  const s = state.status === 'ok' ? state.stats : null
  return [
    { key: 'agents', label: 'Registered Agents', value: s?.agents ?? null, decimals: 0, suffix: s?.agentsTruncated ? '+' : '' },
    { key: 'attesters', label: 'Attesters', value: s?.attesters ?? null, decimals: 0, suffix: '' },
    { key: 'totalStaked', label: 'Total Staked', value: s?.totalStaked ?? null, decimals: 4, suffix: ' tTRUST' },
    { key: 'activeStakers', label: 'Active Stakers', value: s?.activeStakers ?? null, decimals: 0, suffix: '' },
  ]
}
