import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setDefaultCacheImplForTests } from '../server-cache'
import { decodeFromCache } from '../json-codec'
import { fetchAllRows, gqlRequest, REQUEST_TIMEOUT_MS, SERVER_ROW_CAP } from '../gql-pager'
import { fetchVaultPositions, VAULT_ID_CHUNK, type VaultPosition } from '../vault-positions'
import type { AgentsPagePayload } from '../agents-page-types'
import type { EvaluatorProfile } from '../evaluator-score'
import { fakeNextCache } from './fake-next-cache'
import { installFakeHasura, type FakeTable } from './fake-hasura'

/**
 * Etap 7c commit 1 — the corpus read fits under the gateway. Production 2026-10-20: the corpus and
 * domain-triples reads answered `GraphQL HTTP 504` (the gateway's 60 s), so /agents, /check and the
 * landing lost every AgentScore agent. The slow request was the vault-positions read: `order_by:
 * { id }` with `term_id: { _in }` walks the whole positions table (4.7–6.0 s alone, 7.5–9.2 s six at
 * a time); `[term_id, id]` is the same order on the term_id index (0.4–1.1 s). Every request now
 * has a 25 s ceiling and one retry on a timeout or 504; a page that still fails fails the read.
 */

vi.mock('../on-chain-pricing', () => ({ getOnChainSharePrice: vi.fn(async () => null) }))
const leaderboard = vi.fn<() => Promise<EvaluatorProfile[]>>(async () => [])
vi.mock('../evaluator-data', async (orig) => ({
  ...(await orig<typeof import('../evaluator-data')>()),
  fetchEvaluatorLeaderboard: () => leaderboard(),
}))

const OPEN_CLAW = '0x0d579846f21a66f35efafb2339d182e27560ec9f9d8ea64f7f1d9929d20a2d7d'
const STAKER = '0x139219107C1eBE569f543C581b3B807Cf6740006'
const CORPUS = [{
  term_id: OPEN_CLAW, label: 'Agent: OPEN CLAW from Kryptoremontier - test', data: null, type: 'Thing', emoji: null,
  created_at: '2026-03-01T00:00:00+00:00', creator: { label: 'x', id: '0x0' },
  positions_aggregate: { aggregate: { sum: { shares: '335061000000000000' }, max: { created_at: '2026-03-01T00:00:00+00:00' } } },
  as_subject_triples: [],
}]
const POSITIONS = [
  { id: `${OPEN_CLAW}-1-${STAKER}`, term_id: OPEN_CLAW, account_id: STAKER, shares: '335061000000000000', created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z', account: { label: 'x' } },
]
const TABLES: FakeTable[] = [
  { match: (q) => q.includes('ApiAgents'), field: 'atoms', rows: CORPUS },
  { match: (q) => q.includes('VaultPositions'), field: 'positions', rows: (_q, v) => POSITIONS.filter((p) => (v.vaultIds as string[] | undefined)?.includes(p.term_id) ?? true) },
  { match: (q) => q.includes('GetAttestationTriple'), field: 'triples', rows: [] },
  { match: (q) => /query GetErc8004Cohort[(R]/.test(q), field: 'triples', rows: [] },
  { match: (q) => q.includes('GetErc8004CohortCount'), field: 'triples', rows: [] },
  { match: (q) => q.includes('GetCohortClassification'), field: 'triples', rows: [] },
]

const clock = { t: Date.UTC(2026, 9, 20, 21, 0) }
let cache: ReturnType<typeof fakeNextCache>
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(clock.t)
  cache = fakeNextCache(clock)
  setDefaultCacheImplForTests(cache.impl)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(async () => { await cache.settle(); setDefaultCacheImplForTests(null); vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks() })

describe('gqlRequest — a 25 s ceiling and one retry on a timeout or gateway 504', () => {
  const Q = 'query ApiAgents { atoms(limit: 1) { term_id } }'

  it('the ceiling is 25 s — under the gateway\'s 60 s — and every request carries it', async () => {
    expect(REQUEST_TIMEOUT_MS).toBe(25_000)
    const hasura = installFakeHasura({ tables: TABLES })
    await gqlRequest(Q)
    const init = (globalThis.fetch as unknown as { mock: { calls: Array<[unknown, RequestInit]> } }).mock.calls[0][1]
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(hasura.calls).toHaveLength(1)
  })

  it('504 once → the retry answers; 504 twice → the read fails', async () => {
    let n = 0
    const once = installFakeHasura({ tables: TABLES, fail: () => (n++ === 0 ? 'gateway-timeout' : undefined) })
    await expect(gqlRequest(Q)).resolves.toMatchObject({ atoms: CORPUS })
    expect(once.calls).toHaveLength(2)

    const always = installFakeHasura({ tables: TABLES, fail: () => 'gateway-timeout' })
    await expect(gqlRequest(Q)).rejects.toThrow('GraphQL HTTP 504')
    expect(always.calls).toHaveLength(2) // one retry, never more
  })

  it('no answer within the ceiling → cut and retried once; twice → a timeout error', async () => {
    let n = 0
    const once = installFakeHasura({ tables: TABLES, fail: () => (n++ === 0 ? 'hang' : undefined) })
    await expect(gqlRequest(Q, undefined, { timeoutMs: 30 })).resolves.toMatchObject({ atoms: CORPUS })
    expect(once.calls).toHaveLength(2)

    const always = installFakeHasura({ tables: TABLES, fail: () => 'hang' })
    await expect(gqlRequest(Q, undefined, { timeoutMs: 30 })).rejects.toThrow('GraphQL timeout after 30 ms')
    expect(always.calls).toHaveLength(2)
  })

  it('other failures are not retried as timeouts (a 500 fails at once; 429 keeps its own back-off)', async () => {
    const hasura = installFakeHasura({ tables: TABLES, fail: () => 'throw' })
    await expect(gqlRequest(Q)).rejects.toThrow('network down')
    expect(hasura.calls).toHaveLength(1)
  })
})

describe('the corpus read under a slow gateway', () => {
  async function page(): Promise<AgentsPagePayload> {
    const { GET } = await import('@/app/api/v1/agents/page/route')
    return decodeFromCache<AgentsPagePayload>((await (await GET()).json()).data)
  }
  const corpusEntries = () => [...cache.store.keys()].filter((k) => k.includes('agentscore:agent-corpus'))

  it('one vault-positions page answers 504 → retried, the corpus is read and cached', async () => {
    let failed = false
    installFakeHasura({ tables: TABLES, fail: (q) => (q.includes('VaultPositions') && !failed ? ((failed = true), 'gateway-timeout') : undefined) })
    const body = await page()
    expect(failed).toBe(true)
    expect(body.agentScore).toMatchObject({ status: 'ok', complete: true })
    expect(body.agentScore.status === 'ok' && body.agentScore.value.rows.map((r) => r.term_id)).toEqual([OPEN_CLAW])
    expect(corpusEntries()).toHaveLength(1)
  })

  it('the page fails twice → the corpus read fails: no rows, nothing cached (never a partial corpus)', async () => {
    const hasura = installFakeHasura({ tables: TABLES, fail: (q) => (q.includes('VaultPositions') ? 'gateway-timeout' : undefined) })
    const body = await page()
    expect(body.agentScore).toEqual({ status: 'failed' })
    expect(corpusEntries()).toHaveLength(0)
    expect(hasura.calls.filter((c) => c.query.includes('VaultPositions'))).toHaveLength(2) // the page and its one retry
  })

  it('the domain-triples read gets the same treatment (the same transport and positions read)', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync('src/lib/api-data.ts', 'utf8')
    const domains = src.slice(src.indexOf('async function readDomainTriples'), src.indexOf('/** Our cap on the skill-atom list'))
    expect(domains).toMatch(/request: pagedRequest/)
    expect(domains).toMatch(/fetchVaultPositions\(vaultIds, \{ request: pagedRequest \}\)/)
    expect(src).toMatch(/return gqlRequest<T>\(query, variables, \{ cache: 'no-store', url: GRAPHQL_URL \}\)/)
  })
})

describe('parity — the restructured positions read returns exactly the old rows, in the old order', () => {
  // An indexer that honours `order_by` the way Hasura does, caps pages at 100 positions and counts
  // on the same `where`: so the old query (one `_in`, `order_by: { id }`) and the new one (chunks
  // of ≤ 200, `[term_id, id]`) are each answered as the real endpoint would answer them.
  const hex = (n: number, w = 64) => `0x${n.toString(16).padStart(w, '0')}`
  const VAULTS = Array.from({ length: 450 }, (_, i) => hex(i * 7919 + 13)) // 3 chunks
  const ROWS: VaultPosition[] = VAULTS.flatMap((term_id, i) => Array.from({ length: (i % 4) }, (_, k) => {
    const account = `0x${hex(i * 31 + k * 17 + 5, 40).slice(2)}`
    return { id: `${term_id}-1-${account}`, term_id, account_id: account, shares: String(i % 3 === 0 && k === 0 ? 0 : (i + 1) * 1000 + k), created_at: `2026-0${1 + (i % 9)}-01T00:00:00Z`, updated_at: '2026-10-01T00:00:00Z', account: { label: null } }
  }))
  // Our fixture's ids are what the chain's are: `${term_id}-${curve}-${account}`, 66-char term_ids.
  const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

  function installOrderedIndexer() {
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (_u: unknown, init?: RequestInit) => {
      const { query, variables: v } = JSON.parse(String(init?.body))
      calls.push(query)
      const ids = new Set(v.vaultIds as string[])
      const match = ROWS.filter((r) => ids.has(r.term_id))
      const data: Record<string, unknown> = {}
      if (query.includes('positions_aggregate')) data.positions_aggregate = { aggregate: { count: match.length } }
      if (/\bpositions\s*\(/.test(query)) {
        const byTermThenId = /order_by:\s*\[\{\s*term_id:\s*asc\s*\},\s*\{\s*id:\s*asc\s*\}\]/.test(query)
        const byId = /order_by:\s*\{\s*id:\s*asc\s*\}/.test(query)
        if (!byTermThenId && !byId) throw new Error(`unexpected order: ${query}`)
        const sorted = [...match].sort((a, b) => (byTermThenId ? cmp(a.term_id, b.term_id) || cmp(a.id!, b.id!) : cmp(a.id!, b.id!)))
        data.positions = sorted.slice(v.offset, v.offset + Math.min(v.limit, SERVER_ROW_CAP.positions))
      }
      return { ok: true, status: 200, json: async () => ({ data }) }
    }))
    return calls
  }

  // The read as it was on main (3c16957): one `_in` with every vault, paged in `{ id: asc }`.
  const oldRead = (vaultIds: string[]) => fetchAllRows<VaultPosition>({
    query: `query VaultPositions($vaultIds: [String!]!, $limit: Int!, $offset: Int!) {
      positions(where: { term_id: { _in: $vaultIds } } order_by: { id: asc } limit: $limit offset: $offset) { id term_id account_id shares created_at updated_at account { label } }
    }`,
    field: 'positions',
    countQuery: `query VaultPositionsCount($vaultIds: [String!]!) { positions_aggregate(where: { term_id: { _in: $vaultIds } }) { aggregate { count } } }`,
    countField: 'positions_aggregate',
    variables: { vaultIds: [...new Set(vaultIds)] },
    pageSize: SERVER_ROW_CAP.positions,
    maxRows: 50_000,
  })

  it(`${VAULTS.length} vaults, ${ROWS.length} positions (0-share rows included): the same rows, the same order, every order option`, async () => {
    // The corpus passes vaults in its own order (atom, counter, atom, …), with repeats.
    const asPassed = [...VAULTS].reverse().concat(VAULTS.slice(0, 5))
    installOrderedIndexer()
    const old = await oldRead(asPassed)
    expect(old.truncated).toBe(false)
    expect(old.rows).toHaveLength(ROWS.length)

    const calls = installOrderedIndexer()
    const now = await fetchVaultPositions(asPassed, { withMeta: true })
    expect(now).toEqual(old.rows)
    // Three `_in` chunks of ≤ 200 ids, each paged at 100 positions.
    const ins = calls.filter((q) => /\bpositions\s*\(/.test(q))
    expect(ins.length).toBeGreaterThanOrEqual(Math.ceil(VAULTS.length / VAULT_ID_CHUNK))

    for (const order of ['shares-desc', 'created-asc'] as const) {
      installOrderedIndexer()
      const { sortPositions } = await import('../vault-positions')
      expect(await fetchVaultPositions(asPassed, { withMeta: true, order })).toEqual(sortPositions(old.rows, order))
    }
  })

  it('every `_in` list holds at most 200 vault ids', async () => {
    const lens: number[] = []
    vi.stubGlobal('fetch', vi.fn(async (_u: unknown, init?: RequestInit) => {
      const { variables: v } = JSON.parse(String(init?.body))
      lens.push((v.vaultIds as string[]).length)
      return { ok: true, status: 200, json: async () => ({ data: { positions: [], positions_aggregate: { aggregate: { count: 0 } } } }) }
    }))
    await fetchVaultPositions(VAULTS)
    expect(Math.max(...lens)).toBeLessThanOrEqual(VAULT_ID_CHUNK)
    expect(VAULT_ID_CHUNK).toBe(200)
    expect(lens.reduce((a, b) => a + b, 0)).toBe(VAULTS.length)
  })
})
