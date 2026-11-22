import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { NextRequest } from 'next/server'
import { setDefaultCacheImplForTests } from '../server-cache'
import {
  setGateCallStoreForTests, memoryGateCallStore, gateCallDayKey, isInternalCall, recordGateCall, readGateCalls7d,
  INTERNAL_HEADER, GATE_COUNT_TIMEOUT_MS, type GateCallStore,
} from '../gate-calls'
import { fakeNextCache } from './fake-next-cache'
import { installFakeHasura, type FakeTable } from './fake-hasura'

/**
 * Etap 9 commit 5 — the North Star is readable: /api/v1/stats (and MCP platform_stats) gain
 * `agentsEstablished`, `agentsVerified`, `trustEvents7d` (the tier's and the timeline's own
 * readers) and `gateCalls7d` (outside gate calls, counted in Upstash; without it null and
 * `parts.gateCalls: "unavailable"` — never 0). Each part has its own status.
 *
 * Fake indexer: four AgentScore agents and one ERC-8004 agent.
 *   VERA    3 people, 0.12 tTRUST   → Verified
 *   ESTA    2 people, 0.06 tTRUST   → Established
 *   LUDA    2 people, 0.04554 tTRUST → Unverified (2 people, too little tTRUST — testnet today)
 *   NOBODY  backed, but nobody trusts it → Unverified
 *   DACKIE  (ERC-8004) 2 people, 0.05 tTRUST → Established
 */

vi.mock('../on-chain-pricing', () => ({ getOnChainSharePrice: vi.fn(async () => null) }))
vi.mock('../evaluator-data', async (orig) => ({
  ...(await orig<typeof import('../evaluator-data')>()),
  fetchEvaluatorLeaderboard: async () => [],
}))

const id = (c: string) => `0x${c.repeat(64)}`
const VERA = id('a'), ESTA = id('b'), LUDA = id('c'), NOBODY = id('d'), DACKIE = id('e')
const CRYPTO = '0xecc2b1dce5f8269777d9001faa532642691d7038eed3c639f04895ac5b312d42'
const SOCIAL = '0x9c7db27885e2e35f9a2f674943f61b02f321ea22d91dd48dea6d82647f884a91'
const W = (n: number) => `0x${String(n).padStart(40, '0')}`
const E15 = 10n ** 15n

const NOW = Date.UTC(2026, 10, 18, 12, 0)
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString()

const row = (term_id: string, name: string) => ({
  term_id, label: `{"name":"${name}"}`, data: null, type: 'Thing', emoji: null, created_at: '2026-03-01T00:00:00+00:00',
  creator: { label: 'x', id: '0x0' },
  positions_aggregate: { aggregate: { sum: { shares: '1000000000000000' }, max: { created_at: '2026-03-01T00:00:00+00:00' } } },
  as_subject_triples: [],
})
const CORPUS = [row(VERA, 'Vera'), row(ESTA, 'Esta'), row(LUDA, 'Luda'), row(NOBODY, 'Nobody')]
const SAME_AS = [{
  term_id: '0xsa1', created_at: '2026-07-01T00:00:00Z', subject_id: DACKIE,
  subject: { term_id: DACKIE, label: 'Captain Dackie' }, object: { label: 'eip155:8453/erc721:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432/1380' },
}]
// One trust: a wallet's live position on the triple <agent> — is skilled in — <context>.
interface Trust { triple: string; subject: string; context: string; wallet: string; milli: bigint; at: string }
const t = (triple: string, subject: string, context: string, wallet: number, milli: number, at: string): Trust =>
  ({ triple, subject, context, wallet: W(wallet), milli: BigInt(milli), at })
const TRUSTS: Trust[] = [
  t('0xt1', VERA, CRYPTO, 1, 40, daysAgo(30)), t('0xt1', VERA, CRYPTO, 2, 40, daysAgo(2)), t('0xt2', VERA, SOCIAL, 3, 40, daysAgo(1)),
  t('0xt3', ESTA, CRYPTO, 1, 30, daysAgo(6.9)), t('0xt3', ESTA, CRYPTO, 2, 30, daysAgo(7.1)),
  t('0xt4', LUDA, SOCIAL, 1, 40, daysAgo(40)), t('0xt4', LUDA, SOCIAL, 4, 5, daysAgo(40)),
  t('0xt5', DACKIE, CRYPTO, 1, 25, daysAgo(3)), t('0xt5', DACKIE, CRYPTO, 5, 25, daysAgo(0.5)),
  // Someone who trusted ESTA yesterday and sold out since: no shares, so not a person and not an event.
  t('0xt3', ESTA, CRYPTO, 9, 0, daysAgo(1)),
]
const position = (x: Trust) => ({
  id: `${x.triple}-1-${x.wallet}`, term_id: x.triple, account_id: x.wallet, shares: String(x.milli * E15),
  created_at: x.at, updated_at: x.at, account: { label: 'x' },
})
const backing = (agent: string) => ({ id: `${agent}-1-${W(7)}`, term_id: agent, account_id: W(7), shares: '1000000000000000', created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z', account: { label: 'x' } })
const tripleIds = [...new Set(TRUSTS.map((x) => x.triple))]

const indexer = { failing: (_q: string) => false as boolean }
function tables(): FakeTable[] {
  return [
    { match: (q) => q.includes('ApiAgents'), field: 'atoms', rows: CORPUS },
    { match: (q) => q.includes('FindTrustTriple'), field: 'triples', rows: [] },
    {
      match: (q) => q.includes('GetAttestationTriple'), field: 'triples',
      rows: (_q, v) => {
        const subjects = (v.subjects as string[] | undefined) ?? (v.subjectId ? [v.subjectId as string] : null)
        return tripleIds
          .map((tid) => TRUSTS.find((x) => x.triple === tid)!)
          .filter((x) => !subjects || subjects.includes(x.subject))
          .map((x) => ({ term_id: x.triple, counter_term_id: null, subject: { term_id: x.subject, label: 'x' }, object: { term_id: x.context } }))
      },
    },
    {
      match: (q) => q.includes('VaultPositions'), field: 'positions',
      rows: (_q, v) => [...CORPUS.map((r) => backing(r.term_id)), ...TRUSTS.map(position)].filter((p) => (v.vaultIds as string[] | undefined)?.includes(p.term_id) ?? true),
    },
    { match: (q) => /query GetErc8004Cohort[(R]/.test(q), field: 'triples', rows: SAME_AS },
    { match: (q) => q.includes('GetErc8004CohortCount'), field: 'triples', rows: SAME_AS },
    { match: (q) => q.includes('GetCohortClassification'), field: 'triples', rows: [] },
    { match: (q) => q.includes('ApiSkillCount'), field: 'atoms', rows: [], count: 12 },
    { match: (q) => q.includes('ApiClaimCount'), field: 'triples', rows: [], count: 3 },
    { match: (q) => q.includes('GetAllDomainTriples'), field: 'triples', rows: [] },
    { match: (q) => q.includes('CanonicalTrustTriples'), field: 'triples', rows: tripleIds.map((term_id) => ({ term_id })) },
    {
      match: (q) => q.includes('TrustEventsSince'), field: 'positions',
      rows: (_q, v) => TRUSTS.map(position).filter((p) => (v.ids as string[]).includes(p.term_id) && Date.parse(p.created_at) >= Date.parse(v.since as string)),
    },
  ]
}

let cache: ReturnType<typeof fakeNextCache>
let counter: ReturnType<typeof memoryGateCallStore>

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  cache = fakeNextCache({ t: NOW })
  setDefaultCacheImplForTests(cache.impl)
  indexer.failing = () => false
  installFakeHasura({ tables: tables(), fail: (q) => (indexer.failing(q) ? 'throw' : undefined) })
  counter = memoryGateCallStore()
  setGateCallStoreForTests(counter)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => { setGateCallStoreForTests(undefined); setDefaultCacheImplForTests(null); vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks() })

async function stats() {
  const { GET } = await import('@/app/api/v1/stats/route')
  const res = await GET(new NextRequest('http://localhost/api/v1/stats'))
  const json = await res.json()
  return { status: res.status, cacheControl: res.headers.get('cache-control'), data: json.data, meta: json.meta }
}
async function gate(agent: string, headers: Record<string, string> = {}) {
  const { GET } = await import('@/app/api/v1/agents/[id]/gate/route')
  const res = await GET(new NextRequest(`http://localhost/api/v1/agents/${agent}/gate`, { headers }), { params: Promise.resolve({ id: agent }) })
  return (await res.json()).data
}
async function mcp(name: string, args: Record<string, unknown>, headers: Record<string, string> = {}) {
  const { POST } = await import('@/app/api/mcp/[transport]/route')
  const res = await POST(new Request('http://localhost/api/mcp/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  }))
  const raw = await res.text()
  const rpc = JSON.parse(raw.includes('data:') ? raw.split('\n').find((l) => l.startsWith('data:'))!.slice(5) : raw)
  return JSON.parse(rpc.result.content[0].text)
}

describe('agentsEstablished / agentsVerified — the tier rule\'s own answer, counted', () => {
  it('1 Verified, 2 Established (one of them ERC-8004); 2 people with too little tTRUST is neither', async () => {
    const { status, cacheControl, data } = await stats()
    expect(status).toBe(200)
    expect(data).toMatchObject({ agents: 4, agentsVerified: 1, agentsEstablished: 2 })
    expect(data.parts).toMatchObject({ tiers: 'ok', trustEvents: 'ok', gateCalls: 'ok' })
    expect(cacheControl).not.toBe('no-store')
  })

  it('the North Star = the agents the default gate allows', async () => {
    const { data } = await stats()
    const allowed = []
    for (const agent of [VERA, ESTA, LUDA, NOBODY, DACKIE]) {
      if ((await gate(agent, { [INTERNAL_HEADER]: '1' })).decision === 'allow') allowed.push(agent)
    }
    expect(allowed).toEqual([VERA, ESTA, DACKIE])
    expect(data.agentsEstablished + data.agentsVerified).toBe(allowed.length)
  })

  it('the attestation read failed → null and parts.tiers failed — never 0; the rest still answers', async () => {
    indexer.failing = (q) => q.includes('GetAttestationTriple')
    const { status, cacheControl, data } = await stats()
    expect(status).toBe(200)
    expect(data).toMatchObject({ agents: 4, agentsEstablished: null, agentsVerified: null, trustEvents7d: 5 })
    expect(data.parts).toMatchObject({ corpus: 'ok', tiers: 'failed', trustEvents: 'ok' })
    expect(cacheControl).toBe('no-store')
  })

  it('the ERC-8004 list failed → null as well: half a count is not a count', async () => {
    indexer.failing = (q) => q.includes('GetErc8004Cohort')
    const { data } = await stats()
    expect(data).toMatchObject({ agentsEstablished: null, agentsVerified: null })
    expect(data.parts.tiers).toBe('failed')
  })

  it('no new rule: calculateAgentTier over the list\'s own attestations', () => {
    const src = readFileSync(path.join(__dirname, '..', 'north-star.ts'), 'utf8')
    expect(src).toMatch(/calculateAgentTier\(summarizeAttesters\(view\.attestations\.get\(id\) \?\? \[\]\)\)\.tier/)
    expect(src).toMatch(/getAgentsPageData\(\)/)
    expect(src).not.toMatch(/minAttesters|minAttestedWei|AGENT_TIER_LADDER/)
  })
})

describe('trustEvents7d — live positions opened in the last 7 days on trust triples', () => {
  it('5: inside the window and still held; 7.1 days ago is outside, a sold-out position is no event', async () => {
    expect((await stats()).data.trustEvents7d).toBe(5)
  })

  it('that read failed → null and parts.trustEvents failed — never 0', async () => {
    indexer.failing = (q) => q.includes('TrustEventsSince')
    const { cacheControl, data } = await stats()
    expect(data.trustEvents7d).toBeNull()
    expect(data.parts).toMatchObject({ trustEvents: 'failed', tiers: 'ok' })
    expect(data).toMatchObject({ agentsVerified: 1, agentsEstablished: 2 })
    expect(cacheControl).toBe('no-store')
  })

  it('the same triples and the same live rule as the per-agent history', () => {
    const src = readFileSync(path.join(__dirname, '..', 'trust-events.ts'), 'utf8')
    expect(src.match(/await readCanonicalTrustTripleIds\(\)/g)).toHaveLength(2) // the first trust, and the 7-day count
    expect(src).toMatch(/isLivePosition\(\{ shares: BigInt\(p\.shares \|\| '0'\) \}\)/)
    expect(src).toMatch(/if \(page\.truncated !== false\) throw new Error\('trust events not read to the end'\)/)
  })
})

describe('gateCalls7d — outside calls to the gate', () => {
  it('a REST call and an MCP should_i_trust call count one each; our own (X-AgentScore-Internal) do not', async () => {
    await gate(VERA)
    await gate('Vera')
    await mcp('should_i_trust', { agentId: ESTA })
    await gate(VERA, { [INTERNAL_HEADER]: '1' })
    await gate(VERA, { 'X-AgentScore-Internal': 'true' })
    await mcp('should_i_trust', { agentId: ESTA }, { [INTERNAL_HEADER]: '1' }) // our demo script
    expect(counter.data.get(gateCallDayKey(NOW))).toBe(3)
    const { data } = await stats()
    expect(data.gateCalls7d).toBe(3)
    expect(data.parts.gateCalls).toBe('ok')
  })

  it('7 UTC days, today included; an older day is outside', async () => {
    for (const [d, n] of [[0, 2], [6, 5], [7, 100]] as const) counter.data.set(gateCallDayKey(NOW - d * 86_400_000), n)
    expect(await readGateCalls7d(NOW)).toEqual({ status: 'ok', value: 7 })
    expect(gateCallDayKey(NOW)).toMatch(/:gate-calls:v1:2026-11-18$/)
  })

  it('nothing counted yet, with a counter → 0 is a real answer', async () => {
    expect(await readGateCalls7d(NOW)).toEqual({ status: 'ok', value: 0 })
  })

  it('no store (KV_REST_API_URL / KV_REST_API_TOKEN missing) → null, parts.gateCalls "unavailable" — never 0; still cacheable', async () => {
    setGateCallStoreForTests(null)
    await gate(VERA)
    const { cacheControl, data } = await stats()
    expect(data.gateCalls7d).toBeNull()
    expect(data.parts.gateCalls).toBe('unavailable')
    expect(cacheControl).not.toBe('no-store')
  })

  it('the environment decides: without the two variables there is no counter', () => {
    setGateCallStoreForTests(undefined)
    for (const k of ['KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN']) vi.stubEnv(k, '')
    return readGateCalls7d(NOW).then((r) => { expect(r).toEqual({ status: 'unavailable' }); vi.unstubAllEnvs() })
  })

  it('a counter that fails: the gate still answers, the number is null with parts.gateCalls "failed"', async () => {
    const broken: GateCallStore = { incr: async () => { throw new Error('store down') }, mget: async () => { throw new Error('store down') } }
    setGateCallStoreForTests(broken)
    expect(await gate(VERA)).toMatchObject({ decision: 'allow', agentId: VERA })
    const { data } = await stats()
    expect(data.gateCalls7d).toBeNull()
    expect(data.parts.gateCalls).toBe('failed')
  })

  it('a counter that hangs never holds a gate answer past its cap', async () => {
    setGateCallStoreForTests({ incr: () => new Promise(() => {}), mget: async () => [] })
    const started = performance.now()
    await recordGateCall(null)
    const waited = performance.now() - started
    expect(waited).toBeGreaterThanOrEqual(GATE_COUNT_TIMEOUT_MS - 50)
    expect(waited).toBeLessThan(GATE_COUNT_TIMEOUT_MS + 700)
  })

  it('what marks a call as ours', () => {
    const h = (v?: string) => new Headers(v === undefined ? {} : { [INTERNAL_HEADER]: v })
    expect(isInternalCall(h('1'))).toBe(true)
    expect(isInternalCall(h('true'))).toBe(true)
    expect(isInternalCall(h())).toBe(false)
    expect(isInternalCall(h('0'))).toBe(false)
    expect(isInternalCall(h('false'))).toBe(false)
    expect(isInternalCall(null)).toBe(false)
  })

  it('only a count is stored — and the landing\'s §03 example never reaches the counter', () => {
    const lib = (f: string) => readFileSync(path.join(__dirname, '..', f), 'utf8')
    const calls = lib('gate-calls.ts')
    expect(calls).toMatch(/store\.incr\(gateCallDayKey\(now\), DAY_KEY_TTL_SECONDS\)/)
    const code = calls.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
    expect(code).not.toMatch(/agentId|policy|x-forwarded-for|user-agent/i)
    // §03 calls the gate's function on the server, not the endpoint: it is counted nowhere.
    const landing = lib('landing-data.ts')
    expect(landing).toContain('trustGate(chosen.id, policy)')
    expect(landing).not.toMatch(/gate-calls|recordGateCall|\/gate\b/)
    const route = readFileSync(path.join(__dirname, '..', '..', 'app/api/v1/agents/[id]/gate/route.ts'), 'utf8')
    expect(route).toMatch(/Promise\.all\(\[trustGateFor\(id, parsed\.policy\), recordGateCall\(request\.headers\)\]\)/)
  })
})

describe('MCP platform_stats — the same answer', () => {
  it('carries the four fields and their parts', async () => {
    await gate(VERA)
    const viaMcp = await mcp('platform_stats', {})
    expect(viaMcp).toMatchObject({ agentsVerified: 1, agentsEstablished: 2, trustEvents7d: 5, gateCalls7d: 1 })
    expect(viaMcp.parts).toMatchObject({ tiers: 'ok', trustEvents: 'ok', gateCalls: 'ok' })
  })
})

describe('only additions', () => {
  it('every field /stats had is still there, in the same place', async () => {
    const { data } = await stats()
    expect(Object.keys(data)).toEqual([
      'agents', 'agentsTruncated', 'skills', 'domains', 'claims', 'attesters', 'evaluators', 'totalStaked', 'activeStakers', 'topDomain', 'topAgent',
      'parts', 'agentsEstablished', 'agentsVerified', 'trustEvents7d', 'gateCalls7d',
    ])
    expect(Object.keys(data.parts)).toEqual(['corpus', 'skills', 'attesters', 'claims', 'evaluators', 'domains', 'tiers', 'trustEvents', 'gateCalls'])
  })
})
