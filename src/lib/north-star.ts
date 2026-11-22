/**
 * The North Star, readable (Etap 9, docs/STRATEGY_REVIEW_2026-11.md §10): the number of agents
 * that pass the default gate — Established or above — is `agentsEstablished + agentsVerified` in
 * `GET /api/v1/stats` and MCP `platform_stats`.
 *
 * Nothing new is computed: the tier is `calculateAgentTier(summarizeAttesters(entries))` over the
 * attestations the /agents list already reads for both corpora (lib/agents-page-data.ts, the
 * shared complete-reads cache) — the same reader and the same rule as every card. Only listed
 * agents count: trusting an atom that is not a listed agent moves nothing here.
 *
 * Every part has its own status. A part that couldn't be read is null with `parts.<part>:
 * 'failed'` — never 0 (REPO_MAP §7 rule 5). A list that stopped at a cap is not a count either.
 */

import { getPlatformStats, type StatsPartStatus } from './api-data'
import { getAgentsPageData } from './agents-page-data'
import { agentsPageView, type AgentsPagePayload } from './agents-page-types'
import { summarizeAttesters } from './agent-profile'
import { calculateAgentTier } from './agent-tier'
import { fetchTrustEvents7d } from './trust-events'
import { readGateCalls7d } from './gate-calls'
import { recordLiveRead, unknownOnFailure } from './server-cache'

/**
 * /stats never waited on the ERC-8004 cohort before this etap, and must not start to: with no
 * cached list the tier counts wait this long at most, then answer unread (null, `parts.tiers:
 * 'failed'`, no-store) while the read goes on and fills the cache for the next call.
 */
export const TIERS_READ_CAP_MS = 6_000

function within<T>(read: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  return Promise.race([
    read,
    new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), ms) }),
  ]).finally(() => { if (timer) clearTimeout(timer) })
}

export interface TierCounts {
  /** Exactly Established (`trusted`). */
  established: number
  verified: number
}

/** Listed agents per tier; null when a read the count needs failed or stopped at a cap. */
export function tierCountsOf(payload: AgentsPagePayload | null): TierCounts | null {
  if (!payload) return null
  const view = agentsPageView(payload)
  if (view.agentScore.status !== 'ok' || view.cohort.status !== 'ok') return null
  if (view.agentScore.truncated !== false || view.cohort.truncated !== false) return null
  // Both attestation reads, not just one of them: an unread half is unknown, not "nobody".
  if (payload.agentScore.status !== 'ok' || !payload.agentScore.value.attestations) return null
  if (payload.cohortAttestations.status !== 'ok' || !view.attestations) return null
  const ids = new Set([...view.agentScore.rows.map((r) => r.term_id), ...view.cohort.agents.map((c) => c.termId)])
  const counts: TierCounts = { established: 0, verified: 0 }
  for (const id of ids) {
    const tier = calculateAgentTier(summarizeAttesters(view.attestations.get(id) ?? [])).tier
    if (tier === 'trusted') counts.established++
    else if (tier === 'verified') counts.verified++
  }
  return counts
}

export type GateCallsPartStatus = StatsPartStatus | 'unavailable'

/** /api/v1/stats and MCP platform_stats: the platform stats as before, plus the North Star fields. */
export async function getStatsWithNorthStar() {
  const [stats, page, trustEvents7d, gateCalls] = await Promise.all([
    getPlatformStats(),
    within(getAgentsPageData().catch(() => null), TIERS_READ_CAP_MS), // each of its parts settles (and records itself) on its own
    unknownOnFailure('trust-events-7d', fetchTrustEvents7d()),
    readGateCalls7d(),
  ])
  const tiers = tierCountsOf(page)
  if (!page) recordLiveRead('agent-tiers', false) // not read in time: the answer is incomplete, never cached
  const status = (read: boolean): StatsPartStatus => (read ? 'ok' : 'failed')
  return {
    ...stats,
    /** Agents whose tier is Established (`trusted`) — the tier rule's own answer; null = unread. */
    agentsEstablished: tiers ? tiers.established : null,
    /** Agents whose tier is Verified. North Star = agentsEstablished + agentsVerified. */
    agentsVerified: tiers ? tiers.verified : null,
    /** Times someone began to trust an agent for a trust context in the last 7 days (live positions only). */
    trustEvents7d,
    /** Outside calls to the trust gate (REST + MCP) over the last 7 UTC days; null = not counted or unread. */
    gateCalls7d: gateCalls.status === 'ok' ? gateCalls.value : null,
    parts: {
      ...stats.parts,
      tiers: status(tiers !== null),
      trustEvents: status(trustEvents7d !== null),
      gateCalls: (gateCalls.status === 'ok' ? 'ok' : gateCalls.status) as GateCallsPartStatus,
    },
  }
}
