/**
 * Trust over time (Etap 8b): when each person began to trust an agent, and for which trust context.
 *
 * The timeline reader's canonical `is skilled in` triples (lib/timeline-data.ts, the same read the
 * REST and MCP timeline use) and the positions on their vaults. A trust event is one live position:
 * a wallet, the triple's trust context, and the position's `created_at` — when that wallet first put
 * tTRUST behind the claim. Signals can't say who: a deposit through the FeeProxy is signalled by the
 * FeeProxy, while the position is the person's own (CLAUDE.md, "FeeProxy is creator_id").
 *
 * Only live positions count, the same rule as the tier (lib/live-position.ts): a wallet that sold out
 * is not someone who trusts the agent, so it has no event here. Nothing is interpolated: the curve is
 * the running count of these events, drawn only from 3 events up (MIN_CHART_EVENTS).
 */

import { fetchAllRows, gqlRequest, SERVER_ROW_CAP } from './gql-pager'
import { fetchVaultPositions } from './vault-positions'
import { isLivePosition } from './live-position'
import { readCanonicalSkillTriples } from './timeline-data'
import { completeReadCache, SERVER_CACHE_CEILING, SERVER_CACHE_TTL } from './server-cache'
import { IS_SKILLED_IN } from './canonical-domains'
import { contextByTermId, TRUST_CONTEXTS } from './trust-contexts'
import { isEnsName } from './person-names'
import { sortEvents, type FirstTrust, type TrustEvent } from './trust-events-view'

export { MIN_CHART_EVENTS, sortEvents, isFirstTrust, trustSteps, shouldDrawCurve, type FirstTrust, type TrustEvent } from './trust-events-view'

/** Positions read with meta: the account label rides along (an ENS name, without a second request). */
function eventsFrom(
  triples: ReadonlyArray<{ term_id: string; object: { term_id: string } | null }>,
  positions: ReadonlyArray<{ term_id: string; account_id: string | null; shares: string; created_at: string; account: { label: string | null } | null }>,
): TrustEvent[] {
  const contextOf = new Map<string, string>()
  for (const t of triples) {
    const ctx = contextByTermId(t.object?.term_id)
    if (ctx) contextOf.set(t.term_id.toLowerCase(), ctx.label)
  }
  const out: TrustEvent[] = []
  for (const p of positions) {
    const context = contextOf.get(p.term_id.toLowerCase())
    if (!context || !p.account_id) continue
    let shares = 0n
    try { shares = BigInt(p.shares || '0') } catch { shares = 0n }
    if (!isLivePosition({ shares })) continue
    const label = p.account?.label ?? null
    out.push({ wallet: p.account_id, ens: isEnsName(label) ? label : null, context, at: p.created_at, tripleId: p.term_id })
  }
  return sortEvents(out)
}

/** One agent's trust events, oldest first. Throws on a failed or capped read (never an empty history). */
export async function readAgentTrustEvents(agentTermId: string): Promise<TrustEvent[]> {
  const triples = (await readCanonicalSkillTriples(agentTermId)).filter((t) => contextByTermId(t.object?.term_id))
  if (triples.length === 0) return []
  const positions = await fetchVaultPositions(triples.map((t) => t.term_id), { withMeta: true, order: 'created-asc' })
  return eventsFrom(triples, positions)
}

export const fetchAgentTrustEvents = completeReadCache(
  'agent-trust-events',
  async (agentTermId: string) => ({ value: await readAgentTrustEvents(agentTermId), complete: true }),
  { revalidate: SERVER_CACHE_TTL.agentDetail, tags: (agentTermId) => [`agent:${agentTermId}`] },
)

// ─── The first trust in AgentScore's history ─────────────────────────────────

/** Every canonical `is skilled in` triple whose object is a trust context. Throws on a failed or capped read. */
async function readCanonicalTrustTripleIds(): Promise<string[]> {
  const page = await fetchAllRows<{ term_id: string }>({
    query: `
      query CanonicalTrustTriples($pred: String!, $objects: [String!]!, $limit: Int!, $offset: Int!) {
        triples(where: { predicate_id: { _eq: $pred }, object_id: { _in: $objects } }, order_by: { term_id: asc }, limit: $limit, offset: $offset) { term_id }
      }
    `,
    field: 'triples',
    countQuery: `
      query CanonicalTrustTriplesCount($pred: String!, $objects: [String!]!) {
        triples_aggregate(where: { predicate_id: { _eq: $pred }, object_id: { _in: $objects } }) { aggregate { count } }
      }
    `,
    countField: 'triples_aggregate',
    variables: { pred: IS_SKILLED_IN.termId, objects: TRUST_CONTEXTS.map((c) => c.termId) },
    pageSize: SERVER_ROW_CAP.triples,
    maxRows: 5_000,
  })
  if (page.truncated !== false) throw new Error('canonical trust triples not read to the end')
  return page.rows.map((r) => r.term_id)
}

/**
 * The oldest position on any canonical `is skilled in` triple whose object is a trust context —
 * the first time anyone trusted an agent here. Positions keep their created_at after a sale, so this
 * is the first ever, live or not. null = there is none yet. Throws on a failed or capped read.
 */
export async function readFirstTrust(): Promise<FirstTrust | null> {
  const ids = await readCanonicalTrustTripleIds()
  if (ids.length === 0) return null
  const data = await gqlRequest<{ positions: Array<{ account_id: string | null; term_id: string; created_at: string }> }>(
    `query FirstTrust($ids: [String!]!) {
      positions(where: { term_id: { _in: $ids } }, order_by: [{ created_at: asc }, { id: asc }], limit: 1) { account_id term_id created_at }
    }`,
    { ids },
  )
  const p = data.positions[0]
  return p?.account_id ? { wallet: p.account_id, tripleId: p.term_id, at: p.created_at } : null
}

export const fetchFirstTrust = completeReadCache(
  'first-trust',
  async () => ({ value: await readFirstTrust(), complete: true }),
  { revalidate: 600, tags: () => [] },
)


// ─── Trust events in the last 7 days (Etap 9, /api/v1/stats trustEvents7d) ────

export const TRUST_EVENTS_WINDOW_DAYS = 7

/**
 * How many trust events began in the last 7 days, network-wide: live positions (the tier's rule,
 * lib/live-position.ts) opened in that window on any canonical `is skilled in` triple whose object
 * is a trust context — the same triples and the same event (one live position, its created_at) as
 * the per-agent history above. A wallet that sold out has no event. Throws on a failed or capped
 * read: an unread week is never "0 events".
 */
export async function readTrustEventsSince(sinceIso: string): Promise<number> {
  const ids = await readCanonicalTrustTripleIds()
  if (ids.length === 0) return 0
  const page = await fetchAllRows<{ id: string; shares: string }>({
    query: `
      query TrustEventsSince($ids: [String!]!, $since: timestamptz!, $limit: Int!, $offset: Int!) {
        positions(where: { term_id: { _in: $ids }, created_at: { _gte: $since } }, order_by: [{ created_at: asc }, { id: asc }], limit: $limit, offset: $offset) { id shares }
      }
    `,
    field: 'positions',
    countQuery: `
      query TrustEventsSinceCount($ids: [String!]!, $since: timestamptz!) {
        positions_aggregate(where: { term_id: { _in: $ids }, created_at: { _gte: $since } }) { aggregate { count } }
      }
    `,
    countField: 'positions_aggregate',
    variables: { ids, since: sinceIso },
    pageSize: SERVER_ROW_CAP.positions,
    maxRows: 20_000,
  })
  if (page.truncated !== false) throw new Error('trust events not read to the end')
  return page.rows.filter((p) => {
    try { return isLivePosition({ shares: BigInt(p.shares || '0') }) } catch { return false }
  }).length
}

/** The last 7 days, counted from the read's own time; 5 minutes, like /stats' other counts. */
export const fetchTrustEvents7d = completeReadCache(
  'trust-events-7d',
  async () => ({ value: await readTrustEventsSince(new Date(Date.now() - TRUST_EVENTS_WINDOW_DAYS * 86_400_000).toISOString()), complete: true }),
  // /stats' own ceiling: while the indexer is slow or down, the last complete count is served with its age.
  { revalidate: SERVER_CACHE_TTL.platformStats, hardCeilingSeconds: SERVER_CACHE_CEILING.platformStats, tags: () => [] },
)
