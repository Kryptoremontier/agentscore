import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { setDefaultCacheImplForTests, HARD_CEILING_SECONDS, SERVER_CACHE_CEILING } from '../server-cache'
import { decodeFromCache } from '../json-codec'
import type { AgentsPagePayload } from '../agents-page-types'
import type { EvaluatorProfile } from '../evaluator-score'
import { fakeNextCache } from './fake-next-cache'
import { installFakeHasura, type FakeTable } from './fake-hasura'

/**
 * Etap 7a follow-up — the cache must not depend on the warm-up job (warm-cache.yml runs late or
 * not at all; production saw a 60 s indexer 504 during a refill). The shared, slow-changing reads
 * get a 24 h ceiling, so after a quiet spell of hours a visitor is served the last complete read at
 * once, with its age, and one background refill runs; /api/v1/stats answers part by part instead
 * of a whole-route 500 when one part has no entry and its read fails.
 */

vi.mock('../on-chain-pricing', () => ({ getOnChainSharePrice: vi.fn(async () => null) }))
const leaderboard = vi.fn<() => Promise<EvaluatorProfile[]>>(async () => [])
vi.mock('../evaluator-data', async (orig) => ({
  ...(await orig<typeof import('../evaluator-data')>()),
  fetchEvaluatorLeaderboard: () => leaderboard(),
}))

const OPEN_CLAW = '0x0d579846f21a66f35efafb2339d182e27560ec9f9d8ea64f7f1d9929d20a2d7d'
const DACKIE = '0x45078ae569def2264355f77e592028dd6f1f5d6373c204fe82bf3141ab1861fb'
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
const SAME_AS = [{ term_id: '0xsa1', created_at: '2026-07-01T00:00:00Z', subject_id: DACKIE, subject: { term_id: DACKIE, label: 'Captain Dackie' }, object: { label: 'eip155:8453/erc721:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432/1380' } }]

const TABLES: FakeTable[] = [
  { match: (q) => q.includes('ApiAgents'), field: 'atoms', rows: CORPUS },
  { match: (q) => q.includes('VaultPositions'), field: 'positions', rows: (_q, v) => POSITIONS.filter((p) => (v.vaultIds as string[] | undefined)?.includes(p.term_id) ?? true) },
  { match: (q) => q.includes('GetAttestationTriple'), field: 'triples', rows: [] },
  { match: (q) => /query GetErc8004Cohort[(R]/.test(q), field: 'triples', rows: SAME_AS },
  { match: (q) => q.includes('GetErc8004CohortCount'), field: 'triples', rows: SAME_AS },
  { match: (q) => q.includes('GetCohortClassification'), field: 'triples', rows: [] },
  { match: (q) => q.includes('ApiSkillCount'), field: 'atoms', rows: [], count: 12 },
  { match: (q) => q.includes('ApiClaimCount'), field: 'triples', rows: [], count: 3 },
  { match: (q) => q.includes('GetAllDomainTriples'), field: 'triples', rows: [] },
]

const clock = { t: Date.UTC(2026, 9, 19, 6, 0) }
let cache: ReturnType<typeof fakeNextCache>
let hasura: ReturnType<typeof installFakeHasura>
const indexer = { failing: (_q: string) => false }
/** While closed, every indexer request hangs — a refill that takes as long as the indexer does. */
let gate: { promise: Promise<void>; open: () => void }
const closeGate = () => { let open!: () => void; gate = { promise: new Promise<void>((r) => { open = r }), open } }
const advance = async (ms: number) => { clock.t += ms; vi.setSystemTime(clock.t); await cache.settle() }
const reads = (op: string) => hasura.calls.filter((c) => c.query.includes(op)).length

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  clock.t = Date.UTC(2026, 9, 19, 6, 0)
  vi.setSystemTime(clock.t)
  cache = fakeNextCache(clock)
  setDefaultCacheImplForTests(cache.impl)
  indexer.failing = () => false
  gate = { promise: Promise.resolve(), open: () => {} }
  leaderboard.mockResolvedValue([])
  hasura = installFakeHasura({ tables: TABLES, fail: (q) => (indexer.failing(q) ? 'throw' : undefined) })
  const fake = globalThis.fetch
  vi.stubGlobal('fetch', async (...a: Parameters<typeof fetch>) => { await gate.promise; return fake(...a) })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(async () => { gate.open(); await cache.settle(); setDefaultCacheImplForTests(null); vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks() })

async function page() {
  const { GET } = await import('@/app/api/v1/agents/page/route')
  const res = await GET()
  return { status: res.status, body: decodeFromCache<AgentsPagePayload>((await res.json()).data) }
}

async function stats() {
  const { GET } = await import('@/app/api/v1/stats/route')
  const res = await GET(new (await import('next/server')).NextRequest('http://localhost/api/v1/stats'))
  const json = await res.json()
  return { status: res.status, cacheControl: res.headers.get('cache-control'), data: json.data, meta: json.meta }
}

/** Resolves to the answer if it came within a few ticks — i.e. without waiting on the (closed) indexer. */
async function answeredAtOnce<T>(p: Promise<T>): Promise<T | 'waiting'> {
  return Promise.race([p, new Promise<'waiting'>((r) => setTimeout(() => r('waiting'), 50))])
}

describe('24 h ceiling for the shared, slow-changing reads', () => {
  it('the corpus, cohort, cohort attestations and /stats\' parts get 24 h; everything else keeps 1 h', () => {
    expect(HARD_CEILING_SECONDS).toBe(3600)
    expect(SERVER_CACHE_CEILING).toEqual({
      agentCorpus: 86_400, erc8004Cohort: 86_400, cohortAttestations: 86_400,
      platformStats: 86_400, domains: 86_400, evaluatorLeaderboard: 86_400,
    })
    const src = (f: string) => readFileSync(path.join(__dirname, '..', f), 'utf8')
    const ceilings = Object.keys(SERVER_CACHE_CEILING).map((k) => `hardCeilingSeconds: SERVER_CACHE_CEILING.${k}`)
    const all = ['api-data.ts', 'agents-page-data.ts', 'evaluator-data.ts'].map(src).join('\n')
    for (const c of ceilings) expect(all).toContain(c)
    // Nothing else sets a ceiling: per-agent and per-wallet reads keep the default hour.
    expect(all.match(/hardCeilingSeconds:/g)).toHaveLength(ceilings.length)
    for (const f of ['leaderboard-data.ts', 'timeline-data.ts']) expect(src(f)).not.toMatch(/hardCeilingSeconds/)
  })

  it('/agents/page: entries 5 h old → served at once with their age, then one background refill per part', async () => {
    await page()
    const before = { corpus: reads('ApiAgents('), cohort: reads('query GetErc8004Cohort(') }
    await advance(5 * 3_600_000)

    closeGate() // the indexer is slow: a visitor who had to wait for it would still be waiting
    const answer = await answeredAtOnce(page())
    expect(answer).not.toBe('waiting')
    const { status, body } = answer as Awaited<ReturnType<typeof page>>
    expect(status).toBe(200)
    expect(body.agentScore).toMatchObject({ status: 'ok', complete: true, dataAgeSeconds: 5 * 3600 })
    expect(body.cohort).toMatchObject({ status: 'ok', dataAgeSeconds: 5 * 3600 })
    expect(body.cohortAttestations).toMatchObject({ status: 'ok', dataAgeSeconds: 5 * 3600 })

    gate.open()
    await cache.settle()
    expect(reads('ApiAgents(') - before.corpus).toBe(1) // exactly one refill of the corpus
    expect(reads('query GetErc8004Cohort(') - before.cohort).toBe(1)
    const after = await page()
    expect(after.body.agentScore).toMatchObject({ status: 'ok', dataAgeSeconds: 0 })
  })

  it('/stats: entries 5 h old → served at once with their age, then one background refill per part', async () => {
    expect((await stats()).data).toMatchObject({ agents: 1, skills: 12, claims: 3 })
    const before = { corpus: reads('ApiAgents('), skills: reads('ApiSkillCount'), domains: reads('GetAllDomainTriples(') }
    await advance(5 * 3_600_000)

    closeGate()
    const answer = await answeredAtOnce(stats())
    expect(answer).not.toBe('waiting')
    const { status, data, meta } = answer as Awaited<ReturnType<typeof stats>>
    expect(status).toBe(200)
    expect(data).toMatchObject({ agents: 1, skills: 12, claims: 3, attesters: 0, domains: 0 })
    expect(meta).toMatchObject({ dataAgeSeconds: 5 * 3600 })

    gate.open()
    await cache.settle()
    expect(reads('ApiAgents(') - before.corpus).toBe(1)
    expect(reads('ApiSkillCount') - before.skills).toBe(1)
    expect(reads('GetAllDomainTriples(') - before.domains).toBe(1)
  })

  it('past 24 h the visitor waits for a live read', async () => {
    await page()
    await advance(25 * 3_600_000)
    closeGate()
    expect(await answeredAtOnce(page())).toBe('waiting')
    gate.open()
    await cache.settle()
  })
})

describe('/api/v1/stats — part by part, never a whole-route 500', () => {
  it('cold cache, the corpus read fails → 200 with the corpus fields null and parts.corpus failed; the rest answered; no-store', async () => {
    indexer.failing = (q) => q.includes('ApiAgents')
    const { status, cacheControl, data } = await stats()
    expect(status).toBe(200)
    expect(cacheControl).toBe('no-store')
    expect(data).toMatchObject({
      agents: null, agentsTruncated: null, totalStaked: null, activeStakers: null, topAgent: null,
      skills: 12, claims: 3, attesters: 0, domains: 0, evaluators: 0,
      parts: { corpus: 'failed', skills: 'ok', attesters: 'ok', claims: 'ok', evaluators: 'ok', domains: 'ok' },
    })
  })

  it('cold cache, indexer down → every part failed, every field null (never 0) — still a 200', async () => {
    indexer.failing = () => true
    leaderboard.mockRejectedValue(new Error('down'))
    const { status, cacheControl, data } = await stats()
    expect(status).toBe(200)
    expect(cacheControl).toBe('no-store')
    expect(data).toEqual({
      agents: null, agentsTruncated: null, skills: null, domains: null, claims: null, attesters: null,
      evaluators: null, totalStaked: null, activeStakers: null, topDomain: null, topAgent: null,
      parts: { corpus: 'failed', skills: 'failed', attesters: 'failed', claims: 'failed', evaluators: 'failed', domains: 'failed' },
    })
  })

  it('everything read → every part ok, CDN-cacheable', async () => {
    const { status, cacheControl, data } = await stats()
    expect(status).toBe(200)
    expect(cacheControl).not.toBe('no-store')
    expect(Object.values(data.parts)).toEqual(Array(6).fill('ok'))
  })

  it('the landing treats a stats answer without the corpus as unread ("—"), as before', async () => {
    const { parseLandingStats } = await import('../landing-stats')
    indexer.failing = (q) => q.includes('ApiAgents')
    const { data } = await stats()
    expect(parseLandingStats({ success: true, data })).toBeNull()
  })
})
