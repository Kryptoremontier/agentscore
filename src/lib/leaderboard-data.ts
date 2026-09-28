/**
 * The contributor leaderboard (/leaderboard): who registered agents and skills, created claims,
 * staked and signalled.
 *
 * Etap 4b-finish: every read goes through the shared pager (lib/gql-pager.ts) — the old one-shot
 * reads asked `limit: 500 / 2000 / 5000` and the endpoint returns at most 250 atoms/triples/signals
 * and 100 positions, so they would have stopped short silently — and the result through the shared
 * server cache, complete reads only (lib/server-cache.ts): a read that fails or stops at our cap
 * throws, is never stored, and the page shows an error state, never "no activity" and never a stale
 * page with no age. The page reads it dynamically and prints the data's age.
 */

import { AGENT_PREFIX, SKILL_PREFIX } from '@/lib/gql-filters'
import { fetchAllRows, gqlRequest, SERVER_ROW_CAP, type GqlRequest } from '@/lib/gql-pager'
import { completeReadCache, SERVER_CACHE_TTL, type CompleteRead } from '@/lib/server-cache'

export interface LeaderboardEntry {
  address: string
  agentsRegistered: number
  skillsRegistered: number
  claimsCreated: number
  totalEntities: number
  totalPositions: number
  tTrustStaked: number
  totalSignals: number
  score: number
}

// Checksummed for Hasura _neq filters
const FEE_PROXY_CS = '0x2f76eF07Df7b3904c1350e24Ad192e507fd4ec41'

const request: GqlRequest = (query, variables) => gqlRequest(query, variables, { cache: 'no-store' })

/** Our ceiling per read. Reaching it with rows left is a failure here (never a silent prefix). */
const LEADERBOARD_READ_MAX = 10_000

/** Every row of one read, paged to its aggregate count on the same `where`; throws when it can't finish. */
async function readAll<T>(name: string, table: keyof typeof SERVER_ROW_CAP, where: string, fields: string, orderBy: string, variables?: Record<string, unknown>, varDecl = ''): Promise<T[]> {
  const page = await fetchAllRows<T>({
    query: `query ${name}(${varDecl}$limit: Int!, $offset: Int!) {
      ${table}(where: ${where}, order_by: ${orderBy}, limit: $limit, offset: $offset) { ${fields} }
    }`,
    field: table,
    countQuery: `query ${name}Count${varDecl ? `(${varDecl.replace(/,\s*$/, '')})` : ''} { ${table}_aggregate(where: ${where}) { aggregate { count } } }`,
    countField: `${table}_aggregate`,
    variables,
    pageSize: SERVER_ROW_CAP[table],
    maxRows: LEADERBOARD_READ_MAX,
    request,
  })
  if (page.truncated !== false) throw new Error(`leaderboard ${name} not read to the end`)
  return page.rows
}

async function readLeaderboard(): Promise<CompleteRead<LeaderboardEntry[]>> {
  const agentWhere = `{ label: { _ilike: "${AGENT_PREFIX}%" } }`
  const skillWhere = `{ _or: [
    { label: { _ilike: "${SKILL_PREFIX}%" } }
    { as_subject_triples: { predicate: { label: { _eq: "is" } } object: { label: { _eq: "Agent Skill" } } } }
  ] }`
  const claimWhere = `{
    creator_id: { _neq: "${FEE_PROXY_CS}" }
    _or: [
      { subject: { label: { _ilike: "${AGENT_PREFIX}%" } } }
      { subject: { label: { _ilike: "${SKILL_PREFIX}%" } } }
    ]
  }`
  const [agents, skills, claims] = await Promise.all([
    readAll<{ term_id: string }>('LeaderboardAgents', 'atoms', agentWhere, 'term_id', '{ term_id: asc }'),
    readAll<{ term_id: string }>('LeaderboardSkills', 'atoms', skillWhere, 'term_id', '{ term_id: asc }'),
    readAll<{ term_id: string; creator_id: string }>('LeaderboardClaims', 'triples', claimWhere, 'term_id creator_id', '{ term_id: asc }'),
  ])

  const agentTermIds = new Set(agents.map(a => a.term_id).filter(Boolean))
  const skillTermIds = new Set(skills.map(s => s.term_id).filter(Boolean))
  const allTermIds = [...agentTermIds, ...skillTermIds]

  let positions: Array<{ account_id: string; shares: string; total_deposit_assets_after_total_fees: string; term_id: string }> = []
  let signals: Array<{ account_id: string }> = []
  if (allTermIds.length > 0) {
    const ids = { ids: allTermIds }
    ;[positions, signals] = await Promise.all([
      // created_at asc, then id: the first holder of a vault is its registrant (CLAUDE.md "GraphQL quirks").
      readAll<{ account_id: string; shares: string; total_deposit_assets_after_total_fees: string; term_id: string }>(
        'LeaderboardPositions', 'positions',
        `{ term_id: { _in: $ids }, shares: { _gt: "0" }, account_id: { _neq: "${FEE_PROXY_CS}" } }`,
        'account_id shares total_deposit_assets_after_total_fees term_id', '[{ created_at: asc }, { id: asc }]',
        ids, '$ids: [String!]!, ',
      ),
      readAll<{ account_id: string }>(
        'LeaderboardSignals', 'signals',
        `{ term_id: { _in: $ids }, account_id: { _neq: "${FEE_PROXY_CS}" } }`,
        'account_id', '{ id: asc }',
        ids, '$ids: [String!]!, ',
      ),
    ])
  }

  const firstHolderByVault = new Map<string, string>()
  for (const p of positions) {
    const vid = p.term_id
    if (vid && !firstHolderByVault.has(vid)) firstHolderByVault.set(vid, p.account_id)
  }

  const map = new Map<string, LeaderboardEntry>()

  const ensure = (addr: string): LeaderboardEntry => {
    if (!addr) return { address: '', agentsRegistered: 0, skillsRegistered: 0, claimsCreated: 0, totalEntities: 0, totalPositions: 0, tTrustStaked: 0, totalSignals: 0, score: 0 }
    if (!map.has(addr)) {
      map.set(addr, { address: addr, agentsRegistered: 0, skillsRegistered: 0, claimsCreated: 0, totalEntities: 0, totalPositions: 0, tTrustStaked: 0, totalSignals: 0, score: 0 })
    }
    return map.get(addr)!
  }

  for (const termId of agentTermIds) {
    const holder = firstHolderByVault.get(termId)
    if (holder) ensure(holder).agentsRegistered++
  }
  for (const termId of skillTermIds) {
    const holder = firstHolderByVault.get(termId)
    if (holder) ensure(holder).skillsRegistered++
  }
  for (const c of claims) { if (c.creator_id) ensure(c.creator_id).claimsCreated++ }

  for (const p of positions) {
    if (p.account_id) {
      const e = ensure(p.account_id)
      e.totalPositions++
      e.tTrustStaked += Number(p.total_deposit_assets_after_total_fees) / 1e18
    }
  }

  for (const sig of signals) {
    if (sig.account_id) ensure(sig.account_id).totalSignals++
  }

  const entries = Array.from(map.values())
    .map(e => ({
      ...e,
      totalEntities: e.agentsRegistered + e.skillsRegistered + e.claimsCreated,
      score: Math.round(
        e.agentsRegistered * 15 +
        e.skillsRegistered * 15 +
        e.claimsCreated * 10 +
        e.totalPositions * 5 +
        e.tTrustStaked * 20 +
        e.totalSignals * 1
      ),
    }))
    .filter(e => e.score > 0)
    .sort((a, b) => b.score - a.score)
  // Every read above threw unless it reached the end: what gets here is complete.
  return { value: entries, complete: true }
}

/**
 * The contributor leaderboard — shared server cache, SERVER_CACHE_TTL.contributorLeaderboard
 * seconds, complete reads only. Throws when the read fails.
 */
export const fetchLeaderboardData = completeReadCache('contributor-leaderboard', readLeaderboard, {
  revalidate: SERVER_CACHE_TTL.contributorLeaderboard,
  tags: () => [],
})
