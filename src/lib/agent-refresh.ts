/**
 * Our own writes refresh what they changed (Etap 9d). After a trust or a withdrawal in AgentScore
 * (the receipt confirmed), the browser calls POST /api/v1/refresh with the agent's id; this refills,
 * after the response, the cached reads that write can change. Nothing is sent but the id: no value
 * can be injected, only a fresh read from the indexer, stored only if it is complete (a failed or
 * incomplete read keeps the old entry — lib/server-cache.ts refresh).
 */

import { refreshCachedRead, afterResponse, type RefreshOutcome } from './server-cache'
// Imported for their cached reads: each registers its refresh by key when the module loads.
import { loadErc8004Cohort } from './api-data'
import './agents-page-data'
import './trust-events'
import './timeline-data'

/** POST /api/v1/refresh: at most 6 per minute per IP (per server instance — lib/rate-limit.ts). */
export const REFRESH_LIMIT = { limit: 6, windowMs: 60_000 } as const

/** A term id: 0x + 64 hex. Anything else is refused before any read. */
export const AGENT_ID_RE = /^0x[0-9a-fA-F]{64}$/

export interface RefreshStep { key: string; args: unknown[] }

/**
 * What one agent's trust change can change, in the order refilled:
 * - that agent's reads: its vault positions, its attestations, its trust events, its timeline;
 * - the tiers part of /stats (agentsEstablished / agentsVerified): the AgentScore corpus (it carries
 *   its agents' attestations) and the ERC-8004 cohort's attestations;
 * - /stats: the counts (attesters among them) and the 7-day trust events.
 */
export function refreshPlan(agentId: string, cohortIds: readonly string[] | null): RefreshStep[] {
  return [
    { key: 'agent-vault', args: [agentId] },
    { key: 'agent-attestations', args: [agentId] },
    { key: 'agent-trust-events', args: [agentId] },
    { key: 'agent-timeline', args: [agentId] },
    { key: 'agent-corpus', args: [] },
    ...(cohortIds ? [{ key: 'cohort-attestations', args: [[...cohortIds].sort()] }] : []),
    { key: 'platform-stats', args: [] },
    { key: 'trust-events-7d', args: [] },
  ]
}

/** The ERC-8004 cohort's ids from the cached cohort (the key of its attestations entry); null when unread. */
async function cohortIds(): Promise<string[] | null> {
  try {
    return (await loadErc8004Cohort()).agents.map((a) => a.termId)
  } catch {
    return null
  }
}

export interface RefreshDeps {
  refresh: (key: string, args: unknown[]) => Promise<RefreshOutcome>
  cohortIds: () => Promise<string[] | null>
}

/** Run the plan: the agent's own reads together, then the shared ones one at a time (the indexer's budget). */
export async function runAgentRefresh(agentId: string, deps: RefreshDeps = { refresh: refreshCachedRead, cohortIds }): Promise<Array<RefreshStep & { outcome: RefreshOutcome }>> {
  const plan = refreshPlan(agentId, await deps.cohortIds())
  const own = plan.filter((s) => s.key.startsWith('agent-') && s.key !== 'agent-corpus')
  const shared = plan.filter((s) => !own.includes(s))
  const done: Array<RefreshStep & { outcome: RefreshOutcome }> = []
  const settle = async (s: RefreshStep) => {
    const outcome = await deps.refresh(s.key, s.args).catch((): RefreshOutcome => 'kept')
    done.push({ ...s, outcome })
  }
  await Promise.all(own.map(settle))
  for (const s of shared) await settle(s)
  return done
}

/** Start the refresh after the response (kept alive by the platform hook). */
export function startAgentRefresh(agentId: string): void {
  afterResponse(`agentscore:refresh:${agentId}`, async () => {
    const done = await runAgentRefresh(agentId)
    console.info(`[refresh] ${agentId}: ${done.map((d) => `${d.key}=${d.outcome}`).join(' ')}`)
  })
}
