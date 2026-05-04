import { unstable_cache } from 'next/cache'
import { APP_CONFIG } from '@/lib/app-config'
import { AGENT_PREFIX, SKILL_PREFIX } from '@/lib/gql-filters'

const GRAPHQL_URL = APP_CONFIG.GRAPHQL_URL

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

async function gql<T>(query: string): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const json = await res.json()
  if (json.errors) throw new Error(json.errors[0].message)
  return json.data as T
}

async function fetchLeaderboardDataImpl(): Promise<LeaderboardEntry[]> {
  const entities = await gql<{
    agents: Array<{ term_id: string }>
    skills: Array<{ term_id: string }>
    claims: Array<{ creator_id: string }>
  }>(`
    query LeaderboardEntities {
      agents: atoms(
        where: { label: { _ilike: "${AGENT_PREFIX}%" } }
        limit: 500
      ) { term_id }

      skills: atoms(
        where: {
          _or: [
            { label: { _ilike: "${SKILL_PREFIX}%" } }
            { as_subject_triples: {
                predicate: { label: { _eq: "is" } }
                object: { label: { _eq: "Agent Skill" } }
            }}
          ]
        }
        limit: 500
      ) { term_id }

      claims: triples(
        where: {
          creator_id: { _neq: "${FEE_PROXY_CS}" }
          _or: [
            { subject: { label: { _ilike: "${AGENT_PREFIX}%" } } }
            { subject: { label: { _ilike: "${SKILL_PREFIX}%" } } }
          ]
        }
        limit: 500
      ) { creator_id }
    }
  `)

  const agentTermIds = new Set((entities.agents || []).map(a => a.term_id).filter(Boolean))
  const skillTermIds = new Set((entities.skills || []).map(s => s.term_id).filter(Boolean))
  const allTermIds = [...agentTermIds, ...skillTermIds]

  let positions: Array<{ account_id: string; shares: string; total_deposit_assets_after_total_fees: string; vault: { term_id: string } }> = []
  let signals: Array<{ account_id: string }> = []

  if (allTermIds.length > 0) {
    const termIdList = allTermIds.map(id => `"${id}"`).join(', ')
    const activity = await gql<{
      positions: Array<{ account_id: string; shares: string; total_deposit_assets_after_total_fees: string; vault: { term_id: string } }>
      signals: Array<{ account_id: string }>
    }>(`
      query LeaderboardActivity {
        positions(
          where: {
            vault: { term_id: { _in: [${termIdList}] } }
            shares: { _gt: "0" }
            account_id: { _neq: "${FEE_PROXY_CS}" }
          }
          order_by: { created_at: asc }
          limit: 2000
        ) { account_id shares total_deposit_assets_after_total_fees vault { term_id } }

        signals(
          where: {
            vault: { term_id: { _in: [${termIdList}] } }
            account_id: { _neq: "${FEE_PROXY_CS}" }
          }
          limit: 5000
          order_by: { created_at: desc }
        ) { account_id }
      }
    `)
    positions = activity.positions || []
    signals = activity.signals || []
  }

  const firstHolderByVault = new Map<string, string>()
  for (const p of positions) {
    const vid = p.vault?.term_id
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
  for (const c of entities.claims || []) { if (c.creator_id) ensure(c.creator_id).claimsCreated++ }

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

  return Array.from(map.values())
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
}

export const fetchLeaderboardData = unstable_cache(
  fetchLeaderboardDataImpl,
  ['leaderboard-data'],
  { revalidate: 300, tags: ['leaderboard-data'] },
)
