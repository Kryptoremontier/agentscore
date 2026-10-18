import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { setDefaultCacheImplForTests } from '../server-cache'
import { GATE_LOOKUP_UNREAD, GATE_NOT_FOUND, GATE_VOUCHES_UNREAD, type GateDecision } from '../trust-gate'
import { fakeNextCache } from './fake-next-cache'
import { installFakeHasura, type FakeTable } from './fake-hasura'
import { trustGate as pastedTrustGate } from '../../../examples/trust-gate'

/**
 * Etap 7 — the trust gate on its machine surfaces: REST GET /api/v1/agents/:id/gate and MCP
 * should_i_trust, both through the shared complete-reads cache, and the paste-able snippet
 * (examples/trust-gate.ts) run against the REST route. Fake indexer shaped like testnet
 * 2026-10-18: Luda 2 people (3 areas), Captain Dackie 1 person in Crypto / Onchain, OPEN CLAW none.
 */

vi.mock('../on-chain-pricing', () => ({ getOnChainSharePrice: vi.fn(async () => null) }))
vi.mock('../evaluator-data', async (orig) => ({
  ...(await orig<typeof import('../evaluator-data')>()),
  fetchEvaluatorLeaderboard: async () => [],
}))

const LUDA = '0x82d87d9517b68e653418c0e49805b36aca3e33a00536af25fc319f5c24802c5a'
const OPEN_CLAW = '0x0d579846f21a66f35efafb2339d182e27560ec9f9d8ea64f7f1d9929d20a2d7d'
const DACKIE = '0x45078ae569def2264355f77e592028dd6f1f5d6373c204fe82bf3141ab1861fb'
const NOBODY = `0x${'0'.repeat(64)}`
const CRYPTO = '0xecc2b1dce5f8269777d9001faa532642691d7038eed3c639f04895ac5b312d42'
const KNOWLEDGE = '0x8a0e3710014141458ee303a6cc504704ee3da370450d7f5cd5a898186a2f66e4'
const AI = '0x0caa623ae3f31ffaa9bf4e27acd1c25d1f7fe3a141145fd77c82cd21b4f59226'
const SOCIAL = '0x9c7db27885e2e35f9a2f674943f61b02f321ea22d91dd48dea6d82647f884a91'
const KRYPTO = '0x139219107C1eBE569f543C581b3B807Cf6740006'
const CCA0 = '0xCCA0592b0bf23C10aFc58f65d28eE8C0E78aA21C'

const row = (term_id: string, label: string, shares: string) => ({
  term_id, label, data: null, type: 'Thing', emoji: null, created_at: '2026-03-01T00:00:00+00:00',
  creator: { label: 'x', id: '0x0' },
  positions_aggregate: { aggregate: { sum: { shares }, max: { created_at: '2026-03-01T00:00:00+00:00' } } },
  as_subject_triples: [],
})
const CORPUS = [row(LUDA, '{"name":"Luda"}', '980000000000000'), row(OPEN_CLAW, 'Agent: OPEN CLAW from Kryptoremontier - test', '335061000000000000')]
const SAME_AS = [{
  term_id: '0xsa1', created_at: '2026-07-01T00:00:00Z', subject_id: DACKIE,
  subject: { term_id: DACKIE, label: 'Captain Dackie' }, object: { label: 'eip155:8453/erc721:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432/1380' },
}]
// Attestation triples (agent — is skilled in — area) and the positions on them.
const ATTESTATIONS: Array<{ id: string; subject: string; label: string; area: string; wallet: string; shares: string }> = [
  { id: '0xa1', subject: LUDA, label: 'Luda', area: KNOWLEDGE, wallet: KRYPTO, shares: '30690000000000000' },
  { id: '0xa2', subject: LUDA, label: 'Luda', area: AI, wallet: KRYPTO, shares: '9900000000000000' },
  { id: '0xa3', subject: LUDA, label: 'Luda', area: SOCIAL, wallet: CCA0, shares: '4950000000000000' },
  { id: '0xa4', subject: DACKIE, label: 'Captain Dackie', area: CRYPTO, wallet: KRYPTO, shares: '9900000000000000' },
]
const position = (vault: string, wallet: string, shares: string) => ({
  id: `${vault}-1-${wallet}`, term_id: vault, account_id: wallet, shares,
  created_at: '2026-06-01T00:00:00Z', updated_at: '2026-06-01T00:00:00Z', account: { label: 'x' },
})
const POSITIONS = [
  position(OPEN_CLAW, KRYPTO, '335061000000000000'), // backing — not a vouch
  ...ATTESTATIONS.map((a) => position(a.id, a.wallet, a.shares)),
]

const indexer = { down: false, attestationsDown: false }
function tables(): FakeTable[] {
  return [
    { match: (q) => q.includes('ApiAgents'), field: 'atoms', rows: CORPUS },
    { match: (q) => q.includes('ApiAgent') && !q.includes('ApiAgents'), field: 'atoms', rows: [] },
    { match: (q) => q.includes('FindTrustTriple'), field: 'triples', rows: [] },
    {
      match: (q) => q.includes('GetAttestationTriple'), field: 'triples',
      rows: (_q, v) => ATTESTATIONS
        .filter((a) => ((v.subjects as string[] | undefined) ?? [v.subjectId]).includes(a.subject))
        .map((a) => ({ term_id: a.id, counter_term_id: null, subject: { term_id: a.subject, label: a.label }, object: { term_id: a.area } })),
    },
    { match: (q) => q.includes('VaultPositions'), field: 'positions', rows: (_q, v) => POSITIONS.filter((p) => (v.vaultIds as string[] | undefined)?.includes(p.term_id) ?? true) },
    { match: (q) => /query GetErc8004Cohort[(R]/.test(q), field: 'triples', rows: SAME_AS },
    { match: (q) => q.includes('GetErc8004CohortCount'), field: 'triples', rows: SAME_AS },
    { match: (q) => q.includes('GetErc8004CohortAgent'), field: 'triples', rows: (_q, v) => SAME_AS.filter((r) => r.subject.term_id === v.id) },
    { match: (q) => q.includes('GetCohortClassification'), field: 'triples', rows: [] },
  ]
}

const clock = { t: Date.UTC(2026, 9, 18, 14, 0) }
let cache: ReturnType<typeof fakeNextCache>

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(clock.t)
  cache = fakeNextCache(clock)
  setDefaultCacheImplForTests(cache.impl)
  indexer.down = false
  indexer.attestationsDown = false
  installFakeHasura({
    tables: tables(),
    fail: (q) => (indexer.down || (indexer.attestationsDown && q.includes('GetAttestationTriple')) ? 'throw' : undefined),
  })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => { setDefaultCacheImplForTests(null); vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks() })

const AREA_Q = 'minPeople=1&area=Crypto%20%2F%20Onchain'

async function rest(id: string, query = '', headers: Record<string, string> = {}) {
  const { GET } = await import('@/app/api/v1/agents/[id]/gate/route')
  const res = await GET(new NextRequest(`http://localhost/api/v1/agents/${id}/gate${query ? `?${query}` : ''}`, { headers }), { params: Promise.resolve({ id }) })
  return { status: res.status, cacheControl: res.headers.get('cache-control'), body: await res.json() }
}

async function mcp(args: Record<string, unknown>) {
  const { POST } = await import('@/app/api/mcp/[transport]/route')
  const res = await POST(new Request('http://localhost/api/mcp/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'should_i_trust', arguments: args } }),
  }))
  const raw = await res.text()
  const rpc = JSON.parse(raw.includes('data:') ? raw.split('\n').find((l) => l.startsWith('data:'))!.slice(5) : raw)
  const text: string = rpc.result?.content?.[0]?.text ?? ''
  return { isError: !!rpc.result?.isError || !!rpc.error, text, answer: rpc.result?.isError ? null : (JSON.parse(text) as GateDecision) }
}

describe('REST GET /api/v1/agents/:id/gate', () => {
  it('the default policy (Trusted or above): nobody is Trusted today → deny, with who vouches and the data age', async () => {
    const luda = await rest(LUDA)
    expect(luda.status).toBe(200)
    expect(luda.cacheControl).toBe('public, s-maxage=15, stale-while-revalidate=30')
    expect(luda.body.data).toMatchObject({
      decision: 'deny', tier: 'unverified', peopleVouching: 2, policy: { minTier: 'trusted' },
      areas: [
        { area: 'Knowledge / Productivity', people: 1, tTrust: '0.03069' },
        { area: 'AI / Coding', people: 1, tTrust: '0.0099' },
        { area: 'Social', people: 1, tTrust: '0.00495' },
      ],
      meta: { dataAgeSeconds: 0 },
    })
    expect(luda.body.meta).toMatchObject({ dataAgeSeconds: 0, dataReadAt: new Date(clock.t).toISOString() })
    expect((await rest(DACKIE)).body.data).toMatchObject({ decision: 'deny', tier: 'unverified', peopleVouching: 1 })
    expect((await rest(OPEN_CLAW)).body.data).toMatchObject({ decision: 'deny', tier: 'unverified', peopleVouching: 0, areas: [] })
  })

  it('minPeople=1 in Crypto / Onchain: Captain Dackie allow; Luda and OPEN CLAW deny (backing is not a vouch)', async () => {
    expect((await rest(DACKIE, AREA_Q)).body.data).toMatchObject({
      decision: 'allow', peopleVouching: 1, policy: { minPeople: 1, area: 'Crypto / Onchain' },
      reason: '1 person vouches for this agent in Crypto / Onchain; your policy needs at least 1.',
    })
    expect((await rest(LUDA, AREA_Q)).body.data).toMatchObject({ decision: 'deny', peopleVouching: 0 })
    expect((await rest(OPEN_CLAW, AREA_Q)).body.data).toMatchObject({ decision: 'deny', peopleVouching: 0 })
    expect((await rest(LUDA, 'minPeople=1&area=Knowledge%20%2F%20Productivity')).body.data).toMatchObject({ decision: 'allow' })
  })

  it('an id no reader knows → deny "Not found…" (corpus and cohort read to the end)', async () => {
    expect((await rest(NOBODY)).body.data).toMatchObject({ decision: 'deny', reason: GATE_NOT_FOUND, tier: null, peopleVouching: null, areas: null })
    expect((await rest('not-an-id')).body.data).toMatchObject({ decision: 'deny', reason: GATE_NOT_FOUND })
  })

  it('a checksummed term id answers like the indexer\'s lowercase one', async () => {
    expect((await rest(DACKIE.toUpperCase().replace('0X', '0x'), AREA_Q)).body.data).toMatchObject({ decision: 'allow' })
  })

  it.each([
    ['minPeople=1&area=Crypto', /Unknown area "Crypto"/],
    ['minTier=unverified', /minTier must be/],
    ['minTier=trusted&minPeople=1', /not both/],
    ['minPeople=0', /1 or more/],
    ['area=Social', /area goes with minPeople/],
  ])('?%s → 400, never a silent deny', async (query, error) => {
    const r = await rest(DACKIE, query)
    expect(r.status).toBe(400)
    expect(r.body).toMatchObject({ success: false })
    expect(r.body.error).toMatch(error)
    expect(r.body.data).toBeUndefined()
  })

  it('nothing is for sale: other parameters and payment headers change nothing', async () => {
    const plain = await rest(OPEN_CLAW, AREA_Q)
    const paid = await rest(OPEN_CLAW, `${AREA_Q}&paid=1&override=allow&decision=allow&tier=verified`, { 'x-payment': 'eyJ4NDAyIjoxfQ==', authorization: 'Bearer anything' })
    expect(paid.body.data).toEqual(plain.body.data)
    expect(paid.body.data.decision).toBe('deny')
  })
})

describe('fail closed — a failed read is unknown, never allow, never cached', () => {
  it('attestation read fails → unknown, no-store (AgentScore and ERC-8004 agents alike)', async () => {
    indexer.attestationsDown = true
    for (const id of [LUDA, DACKIE]) {
      const r = await rest(id, AREA_Q)
      expect(r.status).toBe(200)
      expect(r.cacheControl).toBe('no-store')
      expect(r.body.data).toMatchObject({ decision: 'unknown', reason: GATE_VOUCHES_UNREAD, tier: null, peopleVouching: null, areas: null })
    }
  })

  it('indexer down and nothing cached → unknown (never "not found"), no-store', async () => {
    indexer.down = true
    const r = await rest(DACKIE, AREA_Q)
    expect(r.cacheControl).toBe('no-store')
    expect(r.body.data).toMatchObject({ decision: 'unknown', reason: GATE_LOOKUP_UNREAD })
    expect((await rest(NOBODY)).body.data.decision).toBe('unknown')
  })

  it('indexer down after a complete read → the cached read decides, and says how old it is', async () => {
    await rest(DACKIE, AREA_Q)
    clock.t += 10 * 60_000
    vi.setSystemTime(clock.t)
    indexer.down = true
    const r = await rest(DACKIE, AREA_Q)
    expect(r.body.data).toMatchObject({ decision: 'allow', meta: { dataAgeSeconds: 600 } })
    expect(r.body.meta.dataAgeSeconds).toBe(600)
    await cache.settle()
  })
})

describe('MCP should_i_trust — same inputs, same answer', () => {
  it('Captain Dackie, minPeople 1 in Crypto / Onchain → allow, the same decision as REST', async () => {
    const { answer, isError } = await mcp({ agentId: DACKIE, minPeople: 1, area: 'Crypto / Onchain' })
    expect(isError).toBe(false)
    const viaRest = (await rest(DACKIE, AREA_Q)).body.data
    expect(answer).toMatchObject({ decision: 'allow', peopleVouching: 1, tier: 'unverified', areas: viaRest.areas, reason: viaRest.reason })
    expect(answer!.meta).toMatchObject({ dataAgeSeconds: 0 })
  })

  it('no policy → the default (Trusted or above); OPEN CLAW deny', async () => {
    expect((await mcp({ agentId: OPEN_CLAW })).answer).toMatchObject({ decision: 'deny', policy: { minTier: 'trusted' } })
  })

  it('an unknown area or two policies → an MCP error, never a silent deny', async () => {
    const area = await mcp({ agentId: DACKIE, minPeople: 1, area: 'Crypto' })
    expect(area.isError).toBe(true)
    expect(area.answer).toBeNull()
    const both = await mcp({ agentId: DACKIE, minPeople: 1, minTier: 'trusted' })
    expect(both).toMatchObject({ isError: true, text: 'Give either minTier or minPeople, not both.' })
  })

  it('a failed read → unknown', async () => {
    indexer.down = true
    expect((await mcp({ agentId: DACKIE, minPeople: 1 })).answer).toMatchObject({ decision: 'unknown' })
  })

  it('the description tells an LLM caller when to call it and what unknown means', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync('src/app/api/mcp/[transport]/route.ts', 'utf8')
    const block = src.slice(src.indexOf("'should_i_trust'"))
    expect(block).toMatch(/BEFORE you pay or delegate/)
    expect(block).toMatch(/"unknown" means the data could not be read right now: treat it as NO — do not pay or delegate/)
  })
})

describe('the snippet to paste (examples/trust-gate.ts), against the REST route', () => {
  const BASE = 'http://agentscore.test'
  // Requests to AgentScore go to the route handler; everything else (the indexer) to the fake.
  function routeAgentScore(opts: { unreachable?: boolean } = {}) {
    const indexerFetch = globalThis.fetch
    vi.stubGlobal('fetch', vi.fn(async (url: unknown, init?: RequestInit) => {
      const u = new URL(String(url))
      if (u.origin !== BASE) return indexerFetch(url as string, init)
      if (opts.unreachable) throw new TypeError('fetch failed')
      const id = decodeURIComponent(u.pathname.split('/')[4])
      const { GET } = await import('@/app/api/v1/agents/[id]/gate/route')
      return GET(new NextRequest(u.toString()), { params: Promise.resolve({ id }) })
    }))
  }

  it('allow / deny exactly as the route answers', async () => {
    routeAgentScore()
    const ok = await pastedTrustGate(DACKIE, { minPeople: 1, area: 'Crypto / Onchain' }, BASE)
    expect(ok).toMatchObject({ decision: 'allow', peopleVouching: 1 })
    const no = await pastedTrustGate(OPEN_CLAW, { minPeople: 1, area: 'Crypto / Onchain' }, BASE)
    expect(no).toMatchObject({ decision: 'deny', reason: 'No one vouches for this agent in Crypto / Onchain; your policy needs at least 1.' })
    expect(await pastedTrustGate(LUDA, undefined, BASE)).toMatchObject({ decision: 'deny', policy: { minTier: 'trusted' } })
  })

  it('a refused policy, a failed read and an unreachable AgentScore are all "unknown" — never allow', async () => {
    routeAgentScore()
    expect(await pastedTrustGate(DACKIE, { minPeople: 1, area: 'Crypto' }, BASE)).toMatchObject({ decision: 'unknown', reason: expect.stringMatching(/Unknown area/) })
    indexer.down = true
    expect(await pastedTrustGate(DACKIE, { minPeople: 1 }, BASE)).toMatchObject({ decision: 'unknown' })
    routeAgentScore({ unreachable: true })
    expect(await pastedTrustGate(DACKIE, { minPeople: 1 }, BASE)).toMatchObject({ decision: 'unknown', reason: 'AgentScore unreachable: fetch failed' })
  })

  it('stays paste-able: about 20 lines, fetch only, no imports', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync('examples/trust-gate.ts', 'utf8')
    expect(src).not.toMatch(/^import /m)
    expect(src).not.toMatch(/require\(/)
    expect(src.trim().split('\n').length).toBeLessThanOrEqual(22)
  })
})
