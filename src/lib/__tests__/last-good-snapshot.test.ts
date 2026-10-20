import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  completeReadCache, currentFreshness, runWithReadLedger, setDefaultCacheImplForTests, settleBackgroundForTests,
  snapshotKeyFor, SERVER_CACHE_CEILING, SNAPSHOT_VERSION, SNAPSHOT_WRITE_INTERVAL_MS,
} from '../server-cache'
import { memorySnapshotStore, setSnapshotStoreForTests, snapshotStore, SNAPSHOT_TIMEOUT_MS } from '../snapshot-store'
import { decodeFromCache, encodeForCache } from '../json-codec'
import type { AgentsPagePayload } from '../agents-page-types'
import type { EvaluatorProfile } from '../evaluator-score'
import { fakeNextCache } from './fake-next-cache'
import { installFakeHasura, type FakeTable } from './fake-hasura'

/**
 * Etap 7c commit 2 — a last-good snapshot that survives deploys. The Data Cache keys change with
 * each build (they include the minified callback's source, PR #31), so a deploy plus a slow indexer
 * emptied /agents (production 2026-10-20). The last complete read of each 24 h-ceiling read is kept
 * in a store outside the build (lib/snapshot-store.ts), under `<read>:<schema version>`; with no Data
 * Cache entry it is served at once with its real age, and one refill runs after the response.
 */

vi.mock('../on-chain-pricing', () => ({ getOnChainSharePrice: vi.fn(async () => null) }))
const leaderboard = vi.fn<() => Promise<EvaluatorProfile[]>>(async () => [])
vi.mock('../evaluator-data', async (orig) => ({
  ...(await orig<typeof import('../evaluator-data')>()),
  fetchEvaluatorLeaderboard: () => leaderboard(),
}))

const H = 3_600_000
const clock = { t: Date.UTC(2026, 9, 20, 21, 0) }
const now = () => clock.t
let cache: ReturnType<typeof fakeNextCache>
let store: ReturnType<typeof memorySnapshotStore>

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  clock.t = Date.UTC(2026, 9, 20, 21, 0)
  vi.setSystemTime(clock.t)
  cache = fakeNextCache(clock)
  store = memorySnapshotStore()
  setSnapshotStoreForTests(store)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
/** Every gate a test closed: opened after it, so a failed test can't hang the next one's settle. */
const gates: Array<() => void> = []
afterEach(async () => {
  gates.splice(0).forEach((open) => open())
  await settleBackgroundForTests()
  await cache.settle()
  setSnapshotStoreForTests(undefined)
  setDefaultCacheImplForTests(null)
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

/** A read that waits until `release()` — an indexer as slow as it gets. */
function gatedRead<T>(value: () => T) {
  let open: () => void = () => {}
  let gate = Promise.resolve()
  const read = vi.fn(async () => { await gate; return { value: value(), complete: true } })
  return { read, close: () => { gate = new Promise<void>((r) => { open = r; gates.push(r) }) }, release: () => open() }
}
const putSnapshot = (key: string, version: number, readAt: number, value: unknown, shape: Record<string, unknown> = {}) =>
  store.data.set(snapshotKeyFor(key, version), JSON.stringify({ key, version, readAt, v: encodeForCache(value), ...shape }))
async function answeredAtOnce<T>(p: Promise<T>): Promise<T | 'waiting'> {
  return Promise.race([p, new Promise<'waiting'>((r) => setTimeout(() => r('waiting'), 50))])
}
const withAge = <T>(get: () => Promise<T>) => runWithReadLedger(async () => ({ v: await get(), f: currentFreshness(clock.t) }))

describe('completeReadCache with a snapshot', () => {
  const opts = (version = 1) => ({ revalidate: 60, hardCeilingSeconds: 86_400, snapshot: version, tags: () => [], cache: cache.impl, now })

  it('no Data Cache entry + a snapshot 3 h old → served at once with age 3 h, then exactly one refill (Data Cache and snapshot)', async () => {
    putSnapshot('k', 1, clock.t - 3 * H, { n: 'from before the deploy' })
    const indexer = gatedRead(() => ({ n: 'fresh' }))
    const get = completeReadCache('k', indexer.read, opts())

    indexer.close()
    const answer = await answeredAtOnce(withAge(get))
    expect(answer).toEqual({ v: { n: 'from before the deploy' }, f: { dataAgeSeconds: 3 * 3600, dataReadAt: new Date(clock.t - 3 * H).toISOString(), complete: true } })
    expect(indexer.read).toHaveBeenCalledTimes(1) // the refill, started after the answer

    indexer.release()
    await settleBackgroundForTests()
    expect(indexer.read).toHaveBeenCalledTimes(1)
    expect(cache.store.size).toBe(1)
    expect(JSON.parse(store.data.get(snapshotKeyFor('k', 1))!)).toMatchObject({ readAt: clock.t, v: { n: 'fresh' } })
    // The next visitor gets the refill from the Data Cache, live.
    expect(await withAge(get)).toMatchObject({ v: { n: 'fresh' }, f: { dataAgeSeconds: 0 } })
    expect(indexer.read).toHaveBeenCalledTimes(1)
  })

  it('schema version mismatch → the snapshot is ignored (the caller reads live), under either key', async () => {
    putSnapshot('k', 1, clock.t - H, { n: 'old shape' }) // what build N stored
    store.data.set(snapshotKeyFor('k', 2), JSON.stringify({ key: 'k', version: 1, readAt: clock.t - H, v: { n: 'mislabelled' } }))
    const indexer = gatedRead(() => ({ n: 'fresh' }))
    const get = completeReadCache('k', indexer.read, opts(2)) // build N+1 bumped the version

    indexer.close()
    expect(await answeredAtOnce(withAge(get))).toBe('waiting')
    indexer.release()
    await settleBackgroundForTests()
    expect(await withAge(get)).toMatchObject({ v: { n: 'fresh' }, f: { dataAgeSeconds: 0 } })
    expect(JSON.parse(store.data.get(snapshotKeyFor('k', 2))!)).toMatchObject({ version: 2, v: { n: 'fresh' } })
    expect(JSON.parse(store.data.get(snapshotKeyFor('k', 1))!).v).toEqual({ n: 'old shape' }) // untouched
  })

  it('a failed read → the snapshot is untouched (and nothing enters the Data Cache)', async () => {
    putSnapshot('k', 1, clock.t - 3 * H, { n: 7 })
    const before = store.data.get(snapshotKeyFor('k', 1))
    const read = vi.fn(async () => { throw new Error('GraphQL HTTP 504') })
    const get = completeReadCache('k', read, opts())
    expect(await withAge(get)).toMatchObject({ v: { n: 7 }, f: { dataAgeSeconds: 3 * 3600 } })
    await settleBackgroundForTests()
    expect(read).toHaveBeenCalledTimes(1) // the one refill, which failed
    expect(store.data.get(snapshotKeyFor('k', 1))).toBe(before)
    expect(store.sets).toBe(0)
    expect(cache.store.size).toBe(0)
  })

  it('an incomplete read is never written to the snapshot (rule 1)', async () => {
    const get = completeReadCache('k', async () => ({ value: { n: null }, complete: false }), opts())
    await get()
    await settleBackgroundForTests()
    expect(store.sets).toBe(0)
  })

  it('a snapshot past the 24 h ceiling is not served: the caller reads live', async () => {
    putSnapshot('k', 1, clock.t - 25 * H, { n: 'a day old' })
    const get = completeReadCache('k', async () => ({ value: { n: 'fresh' }, complete: true }), opts())
    expect(await withAge(get)).toMatchObject({ v: { n: 'fresh' }, f: { dataAgeSeconds: 0 } })
  })

  it('a Data Cache entry exists → the snapshot is not read; a stale entry\'s refill updates it', async () => {
    let n = 0
    const get = completeReadCache('k', async () => ({ value: ++n, complete: true }), opts())
    await get() // fills both
    const getSpy = vi.spyOn(store, 'get')
    clock.t += 10 * 60_000
    vi.setSystemTime(clock.t)
    expect(await withAge(get)).toMatchObject({ v: 1, f: { dataAgeSeconds: 600 } }) // stale, served
    await cache.settle()
    expect(getSpy).not.toHaveBeenCalled()
    expect(JSON.parse(store.data.get(snapshotKeyFor('k', 1))!).v).toBe(2) // the refill wrote it
  })

  it('writes at most once per interval per read and instance; a store that fails changes nothing', async () => {
    let n = 0
    const get = completeReadCache('k', async () => ({ value: ++n, complete: true }), opts())
    await get()
    clock.t += 90_000; vi.setSystemTime(clock.t)
    await get(); await cache.settle() // a refill 90 s later: not written
    expect(store.sets).toBe(1)
    clock.t += SNAPSHOT_WRITE_INTERVAL_MS; vi.setSystemTime(clock.t)
    await get(); await cache.settle()
    expect(store.sets).toBe(2)

    setSnapshotStoreForTests({ get: async () => { throw new Error('store down') }, set: async () => { throw new Error('store down') } })
    const cold = completeReadCache('k2', async () => ({ value: 'live', complete: true }), { ...opts(), cache: fakeNextCache(clock).impl })
    expect(await withAge(cold)).toMatchObject({ v: 'live', f: { dataAgeSeconds: 0 } })
  })

  it('no store configured → no snapshot calls, the read as before', async () => {
    setSnapshotStoreForTests(null)
    const get = completeReadCache('k', async () => ({ value: 1, complete: true }), opts())
    expect(await get()).toBe(1)
    expect(store.sets).toBe(0)
  })
})

describe('the /agents list after a deploy with a slow indexer', () => {
  const OPEN_CLAW = '0x0d579846f21a66f35efafb2339d182e27560ec9f9d8ea64f7f1d9929d20a2d7d'
  const DACKIE = '0x45078ae569def2264355f77e592028dd6f1f5d6373c204fe82bf3141ab1861fb'
  const TABLES: FakeTable[] = [
    { match: (q) => q.includes('ApiAgents'), field: 'atoms', rows: [{
      term_id: OPEN_CLAW, label: 'Agent: OPEN CLAW from Kryptoremontier - test', data: null, type: 'Thing', emoji: null,
      created_at: '2026-03-01T00:00:00+00:00', creator: { label: 'x', id: '0x0' },
      positions_aggregate: { aggregate: { sum: { shares: '1000' }, max: { created_at: '2026-03-01T00:00:00+00:00' } } }, as_subject_triples: [],
    }] },
    { match: (q) => q.includes('VaultPositions'), field: 'positions', rows: [] },
    { match: (q) => q.includes('GetAttestationTriple'), field: 'triples', rows: [] },
    { match: (q) => /query GetErc8004Cohort[(R]/.test(q), field: 'triples', rows: [{ term_id: '0xsa1', created_at: '2026-07-01T00:00:00Z', subject_id: DACKIE, subject: { term_id: DACKIE, label: 'Captain Dackie' }, object: { label: 'eip155:8453/erc721:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432/1380' } }] },
    { match: (q) => q.includes('GetErc8004CohortCount'), field: 'triples', rows: [{ term_id: '0xsa1' }] },
    { match: (q) => q.includes('GetCohortClassification'), field: 'triples', rows: [] },
  ]
  async function page() {
    const { GET } = await import('@/app/api/v1/agents/page/route')
    return decodeFromCache<AgentsPagePayload>((await (await GET()).json()).data)
  }

  it('build N filled the snapshots; build N+1 (no Data Cache entries), indexer hanging → all three parts at once, with their age', async () => {
    setDefaultCacheImplForTests(cache.impl)
    installFakeHasura({ tables: TABLES })
    await page() // build N, live
    await settleBackgroundForTests()
    expect([...store.data.keys()].map((k) => k.split(':').slice(3, 5).join(':')).sort())
      .toEqual(['agent-corpus:1', 'cohort-attestations:1', 'erc8004-cohort:1'])

    // A deploy: new keys, nothing in the Data Cache. Two hours later the indexer doesn't answer.
    cache = fakeNextCache(clock)
    setDefaultCacheImplForTests(cache.impl)
    clock.t += 2 * H; vi.setSystemTime(clock.t)
    let open: () => void = () => {}
    const hung = new Promise<void>((r) => { open = r; gates.push(r) })
    const fake = globalThis.fetch
    vi.stubGlobal('fetch', async (...a: Parameters<typeof fetch>) => { await hung; return fake(...a) })

    const answer = await answeredAtOnce(page())
    expect(answer).not.toBe('waiting')
    const body = answer as AgentsPagePayload
    expect(body.agentScore).toMatchObject({ status: 'ok', dataAgeSeconds: 2 * 3600 })
    expect(body.agentScore.status === 'ok' && body.agentScore.value.rows.map((r) => r.term_id)).toEqual([OPEN_CLAW])
    expect(body.cohort).toMatchObject({ status: 'ok', dataAgeSeconds: 2 * 3600 })
    expect(body.cohortAttestations).toMatchObject({ status: 'ok', dataAgeSeconds: 2 * 3600 })
    open()
    await settleBackgroundForTests()
    expect(cache.store.size).toBe(3) // one refill each
  })
})

describe('wiring', () => {
  it('every 24 h-ceiling read keeps a snapshot, with a schema version', () => {
    expect(Object.keys(SNAPSHOT_VERSION).sort()).toEqual(Object.keys(SERVER_CACHE_CEILING).sort())
    const src = ['api-data.ts', 'agents-page-data.ts', 'evaluator-data.ts'].map((f) => readFileSync(path.join(__dirname, '..', f), 'utf8')).join('\n')
    for (const k of Object.keys(SNAPSHOT_VERSION)) expect(src).toContain(`snapshot: SNAPSHOT_VERSION.${k}`)
    expect(src.match(/snapshot: SNAPSHOT_VERSION\./g)).toHaveLength(Object.keys(SNAPSHOT_VERSION).length)
  })

  it('keys: `<prefix>:<network>:snapshot:<read>:<version>`, arguments hashed', () => {
    expect(snapshotKeyFor('agent-corpus', 1)).toBe('agentscore:testnet:snapshot:agent-corpus:1')
    expect(snapshotKeyFor('cohort-attestations', 1, [['0xa', '0xb']])).toMatch(/^agentscore:testnet:snapshot:cohort-attestations:1:[0-9a-f]{8}$/)
    expect(snapshotKeyFor('cohort-attestations', 1, [['0xa', '0xb']])).not.toBe(snapshotKeyFor('cohort-attestations', 1, [['0xa', '0xc']]))
  })
})

describe('the Upstash REST store', () => {
  afterEach(() => { vi.unstubAllEnvs() })

  it('off without its env vars; with them, GET and SET with an expiry, a bearer token and a timeout', async () => {
    setSnapshotStoreForTests(undefined)
    vi.stubEnv('KV_REST_API_URL', '')
    vi.stubEnv('KV_REST_API_TOKEN', '')
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')
    expect(snapshotStore()).toBeNull()

    vi.stubEnv('KV_REST_API_URL', 'https://example.upstash.io/')
    vi.stubEnv('KV_REST_API_TOKEN', 'tok')
    const calls: Array<{ url: string; init: RequestInit }> = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      const cmd = JSON.parse(String(init.body))
      return { ok: true, status: 200, json: async () => ({ result: cmd[0] === 'GET' ? 'stored' : 'OK' }) }
    }))
    const s = snapshotStore()!
    expect(await s.get('a:b')).toBe('stored')
    await s.set('a:b', '{"x":1}', 172_800)
    expect(calls.map((c) => JSON.parse(String(c.init.body)))).toEqual([['GET', 'a:b'], ['SET', 'a:b', '{"x":1}', 'EX', 172_800]])
    expect(calls[0].url).toBe('https://example.upstash.io')
    expect(calls[0].init.headers).toMatchObject({ Authorization: 'Bearer tok' })
    expect(calls[0].init.signal).toBeInstanceOf(AbortSignal)
    expect(SNAPSHOT_TIMEOUT_MS).toBe(2_000)
  })

  it('a store error throws to the cache, which treats it as no snapshot', async () => {
    vi.stubEnv('KV_REST_API_URL', 'https://example.upstash.io')
    vi.stubEnv('KV_REST_API_TOKEN', 'tok')
    setSnapshotStoreForTests(undefined)
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ error: 'WRONGPASS' }) })))
    await expect(snapshotStore()!.get('a')).rejects.toThrow('snapshot store HTTP 401')
  })
})
