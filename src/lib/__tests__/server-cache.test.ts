import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { NextRequest } from 'next/server'
import {
  completeReadCache,
  currentFreshness,
  decodeFromCache,
  encodeForCache,
  jitteredTtl,
  runWithReadLedger,
  setDefaultCacheImplForTests,
  type CacheImpl,
} from '../server-cache'
import { addFreshnessMeta } from '../mcp-freshness'
import { fakeNextCache } from './fake-next-cache'

/**
 * Etap 4b-cache — the shared server cache (lib/server-cache.ts). Recon (docs/audit/rate-limit.md):
 * every `revalidate` on the API routes was inert, MCP was never cached, and get_agent_trust cost 18
 * requests, so the 5th call in a minute hit the indexer's 75/min limit. Rules under test:
 * only complete reads are stored; every cached answer says how old it is.
 */

describe('completeReadCache — only complete reads are stored', () => {
  const clock = { t: 1_000_000 }
  const now = () => clock.t
  beforeEach(() => { clock.t = 1_000_000 })

  it('a complete read is served from the cache within its TTL, with its age', async () => {
    const cache = fakeNextCache(clock)
    const read = vi.fn(async () => ({ value: { n: 1 }, complete: true }))
    const get = completeReadCache('k', read, { revalidate: 60, tags: () => [], cache: cache.impl, now })

    const first = await runWithReadLedger(async () => ({ v: await get(), f: currentFreshness(clock.t) }))
    expect(first.v).toEqual({ n: 1 })
    expect(first.f).toMatchObject({ dataAgeSeconds: 0, complete: true })

    clock.t += 42_000
    const second = await runWithReadLedger(async () => ({ v: await get(), f: currentFreshness(clock.t) }))
    expect(read).toHaveBeenCalledTimes(1)
    expect(second.v).toEqual({ n: 1 })
    expect(second.f.dataAgeSeconds).toBe(42)
    expect(second.f.dataReadAt).toBe(new Date(1_000_000).toISOString())
  })

  it('a failed read, then a successful one within the TTL → the second caller gets fresh data, not the failure', async () => {
    const cache = fakeNextCache(clock)
    const read = vi.fn()
      .mockRejectedValueOnce(new Error('GraphQL HTTP 429'))
      .mockResolvedValueOnce({ value: { n: 2 }, complete: true })
    const get = completeReadCache('k', read, { revalidate: 60, tags: () => [], cache: cache.impl, now })

    await expect(get()).rejects.toThrow('429')
    clock.t += 5_000
    await expect(get()).resolves.toEqual({ n: 2 })
    expect(read).toHaveBeenCalledTimes(2)
    expect(cache.store.size).toBe(1)
  })

  it('an incomplete read (capped / a sub-read settled to null) is returned as-is and never stored', async () => {
    const cache = fakeNextCache(clock)
    const read = vi.fn()
      .mockResolvedValueOnce({ value: { tiers: null }, complete: false })
      .mockResolvedValueOnce({ value: { tiers: ['unverified'] }, complete: true })
    const get = completeReadCache('k', read, { revalidate: 60, tags: () => [], cache: cache.impl, now })

    const first = await runWithReadLedger(async () => ({ v: await get(), f: currentFreshness(clock.t) }))
    expect(first.v).toEqual({ tiers: null })
    expect(first.f.complete).toBe(false)
    expect(cache.store.size).toBe(0)

    clock.t += 1_000
    const second = await runWithReadLedger(async () => ({ v: await get(), f: currentFreshness(clock.t) }))
    expect(second.v).toEqual({ tiers: ['unverified'] })
    expect(second.f).toMatchObject({ complete: true, dataAgeSeconds: 0 })
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('a read that used an incomplete cached read is itself incomplete (not stored)', async () => {
    const cache = fakeNextCache(clock)
    const inner = completeReadCache('inner', async () => ({ value: 1, complete: false }), { revalidate: 60, tags: () => [], cache: cache.impl, now })
    const outer = completeReadCache('outer', async () => ({ value: (await inner()) + 1, complete: true }), { revalidate: 60, tags: () => [], cache: cache.impl, now })
    const f = await runWithReadLedger(async () => { await outer(); return currentFreshness(clock.t) })
    expect(f.complete).toBe(false)
    expect(cache.store.size).toBe(0)
  })

  it('past 2 × TTL a cached value is not served: the read runs live', async () => {
    const cache = fakeNextCache(clock)
    let n = 0
    const read = vi.fn(async () => ({ value: ++n, complete: true }))
    const get = completeReadCache('k', read, { revalidate: 60, tags: () => [], cache: cache.impl, now })
    await get()
    clock.t += 90_000 // stale (> 60 s), within 2 × TTL: served, revalidated in the background
    const stale = await runWithReadLedger(async () => ({ v: await get(), f: currentFreshness(clock.t) }))
    expect(stale).toMatchObject({ v: 1, f: { dataAgeSeconds: 90 } })
    await cache.settle()
    clock.t += 1_000_000 // an hour of silence
    const live = await runWithReadLedger(async () => ({ v: await get(), f: currentFreshness(clock.t) }))
    expect(live.f.dataAgeSeconds).toBe(0)
    expect(live.v).toBeGreaterThan(2) // a fresh read, not the value from an hour ago
  })

  it('per-call tags (agent:<termId>) and the key reach the cache', async () => {
    const seen: string[][] = []
    const impl: CacheImpl = (cb, _k, { tags }) => { seen.push(tags); return cb }
    const get = completeReadCache('agent-skill-triples', async (id: string) => ({ value: id, complete: true }), { revalidate: 30, tags: (id) => [`agent:${id}`], cache: impl, now })
    await get('0xabc')
    expect(seen[0]).toEqual(['agent-skill-triples', 'agent:0xabc'])
  })
})

describe('JSON codec — bigint and Map survive the Data Cache', () => {
  it('round-trips', () => {
    const v = { a: 12345678901234567890n, m: new Map([['x', { s: 1n }]]), l: [1n, 'z'], n: null }
    expect(decodeFromCache(JSON.parse(JSON.stringify(encodeForCache(v))))).toEqual(v)
  })
})

// ─── Through api-data, REST and MCP ───────────────────────────────────────────

vi.mock('../evaluator-data', () => ({ fetchEvaluatorLeaderboard: vi.fn(async () => []), fetchStakerPositions: vi.fn(async () => []) }))
vi.mock('../on-chain-pricing', () => ({ getOnChainSharePrice: vi.fn(async () => 1_000_000_000_000_000n) }))

const LUDA = '0x82d87d9517b68e653418c0e49805b36aca3e33a00536af25fc319f5c24802c5a'
const CRYPTO = '0xecc2b1dce5f8269777d9001faa532642691d7038eed3c639f04895ac5b312d42'
const LUDA_ROW = {
  term_id: LUDA, label: '{"name":"Luda"}', data: null, type: 'Thing', emoji: null, created_at: '2026-03-01T00:00:00+00:00',
  creator: { label: 'x', id: '0x0' },
  positions_aggregate: { aggregate: { sum: { shares: '980000000000000' }, max: { created_at: '2026-03-01T00:00:00+00:00' } } },
  as_subject_triples: [],
}

function stubIndexer(opts: { attestationsFail?: () => boolean } = {}) {
  const calls: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (_url: unknown, init?: RequestInit) => {
    const q = String(JSON.parse(String(init?.body ?? '{}')).query)
    calls.push(q)
    if (q.includes('GetAttestationTriple') && opts.attestationsFail?.()) {
      return { ok: false, status: 429, json: async () => ({ message: 'API rate limit exceeded' }) }
    }
    // A paged read's first page carries its count in the same document (lib/gql-pager.ts).
    const data = q.includes('ApiAgents') ? { atoms: [LUDA_ROW], atoms_aggregate: { aggregate: { count: 1 } } }
      : q.includes('GetAttestationTriple') ? { triples: [{ term_id: '0xatt', counter_term_id: null, subject: { term_id: LUDA, label: 'Luda' }, object: { term_id: CRYPTO } }], triples_aggregate: { aggregate: { count: 1 } } }
      : { positions: [], triples: [], positions_aggregate: { aggregate: { count: 0 } }, triples_aggregate: { aggregate: { count: 0 } } }
    return { ok: true, status: 200, json: async () => ({ data }) }
  }))
  return calls
}

describe('the agent corpus through the cache (REST /api/v1/agents)', () => {
  const clock = { t: Date.now() }
  let cache: ReturnType<typeof fakeNextCache>
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'Date'] })
    cache = fakeNextCache(clock)
    setDefaultCacheImplForTests(cache.impl)
  })
  afterEach(() => { setDefaultCacheImplForTests(null); vi.unstubAllGlobals(); vi.useRealTimers() })

  it('attestation read fails → tiers unknown, response no-store; the next call re-reads and is cacheable', async () => {
    let fail = true
    const calls = stubIndexer({ attestationsFail: () => fail })
    const { GET } = await import('@/app/api/v1/agents/route')
    const call = async () => {
      const p = GET(new NextRequest('http://localhost/api/v1/agents'))
      await vi.runAllTimersAsync() // the transport's 429 back-off
      return p
    }

    const failed = await call()
    const fb = await failed.json()
    expect(fb.data[0].trustTier).toBeNull()
    expect(failed.headers.get('cache-control')).toBe('no-store')
    expect(fb.meta.dataAgeSeconds).toBe(0)
    expect(cache.store.size).toBe(0)

    fail = false
    const ok = await call()
    const ob = await ok.json()
    expect(ob.data[0].trustTier).toBe('unverified')
    expect(ok.headers.get('cache-control')).toBe('public, s-maxage=15, stale-while-revalidate=30')
    expect(cache.store.size).toBe(1)

    // Within the TTL: no indexer request at all, and the answer says how old it is.
    const before = calls.length
    vi.setSystemTime(Date.now() + 20_000)
    const cached = await (await call()).json()
    expect(calls.length).toBe(before)
    expect(cached.meta.dataAgeSeconds).toBeGreaterThanOrEqual(20)
    expect(cached.data[0].trustTier).toBe('unverified')
  })

  it('the detail and the trust breakdown read the same cached corpus snapshot', async () => {
    const calls = stubIndexer()
    const { getAgentsWithScores, getAgentDetail, getAgentTrustBreakdown } = await import('../api-data')
    await getAgentsWithScores()
    const corpusReads = calls.filter((q) => q.includes('ApiAgents')).length
    const d = await runWithReadLedger(async () => ({ detail: await getAgentDetail(LUDA), trust: await getAgentTrustBreakdown(LUDA) }))
    expect(d.detail?.trustTier).toBe('unverified')
    expect(d.trust?.tier.current).toBe('unverified')
    expect(calls.filter((q) => q.includes('ApiAgent')).length).toBe(corpusReads) // no per-agent row read
  })
})

describe('MCP answers carry meta.dataAgeSeconds', () => {
  it('adds freshness to a JSON object answer; leaves plain text alone', () => {
    const meta = { dataAgeSeconds: 12, dataReadAt: '2026-09-26T00:00:00.000Z' }
    const json = addFreshnessMeta({ type: 'text', text: JSON.stringify({ agent: { id: 'x' } }) }, meta)
    expect(JSON.parse(json.text!)).toEqual({ agent: { id: 'x' }, meta })
    expect(addFreshnessMeta({ type: 'text', text: 'Agent not found' }, meta).text).toBe('Agent not found')
  })
})

describe('every /api/v1 GET runs in a read ledger (meta.dataAgeSeconds can’t be silently 0)', () => {
  const root = path.join(__dirname, '../../app/api/v1')
  const routes: string[] = []
  const walk = (d: string) => { for (const f of readdirSync(d)) { const p = path.join(d, f); if (statSync(p).isDirectory()) walk(p); else if (f === 'route.ts') routes.push(p) } }
  walk(root)
  it.each(routes.map((r) => [path.relative(root, r)]))('%s', (rel) => {
    const src = readFileSync(path.join(root, rel), 'utf8')
    if (!/\bGET\b/.test(src)) return
    expect(src).toMatch(/export const GET = withReadLedger\(/)
    expect(src).not.toMatch(/export const revalidate/)
  })
})

describe('one read in flight per key (Etap 4b-finish: a slow indexer multiplied the reads)', () => {
  it('concurrent misses share one read; the next miss after it settles reads again', async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => { release = r })
    const read = vi.fn(async (id: string) => { await gate; return { value: `v:${id}`, complete: true } })
    // No stored entries between calls (a cache that never keeps anything): every call is a miss.
    const noStore: CacheImpl = (cb) => cb
    const get = completeReadCache('k', read, { revalidate: 60, tags: () => [], cache: noStore })
    const calls = [get('a'), get('a'), get('a'), get('b')]
    release()
    expect(await Promise.all(calls)).toEqual(['v:a', 'v:a', 'v:a', 'v:b'])
    expect(read).toHaveBeenCalledTimes(2) // one per distinct argument, not one per caller
    await get('a')
    expect(read).toHaveBeenCalledTimes(3)
  })

  it('an incomplete shared read is incomplete for every caller that joined it', async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => { release = r })
    const read = vi.fn(async () => { await gate; return { value: 1, complete: false } })
    const get = completeReadCache('k', read, { revalidate: 60, tags: () => [], cache: (cb) => cb })
    const both = Promise.all([0, 1].map(() => runWithReadLedger(async () => { await get(); return currentFreshness().complete })))
    release()
    expect(await both).toEqual([false, false])
    expect(read).toHaveBeenCalledTimes(1)
  })
})

describe('each entry\'s TTL is the configured one ±10 % (Etap 4b-finish: 300 s entries refilled in the same minute)', () => {
  const clock = { t: 1_000_000 }
  const now = () => clock.t
  beforeEach(() => { clock.t = 1_000_000 })
  const draws = (...xs: number[]) => { let i = 0; return () => xs[i++ % xs.length] }
  const storedTtls = (store: Map<string, { body: string }>) => [...store.values()].map((e) => JSON.parse(e.body).ttl)

  it('jitteredTtl: 300 → 270…330, whole seconds, never below 1', () => {
    expect(jitteredTtl(300, () => 0)).toBe(270)
    expect(jitteredTtl(300, () => 0.5)).toBe(300)
    expect(jitteredTtl(300, () => 0.999999)).toBe(330)
    for (let i = 0; i < 200; i++) {
      const t = jitteredTtl(300)
      expect(t).toBeGreaterThanOrEqual(270)
      expect(t).toBeLessThanOrEqual(330)
    }
    expect(jitteredTtl(1, () => 0)).toBe(1)
  })

  it('each stored entry carries its own draw', async () => {
    const cache = fakeNextCache(clock)
    const get = completeReadCache('k', async (id: string) => ({ value: id, complete: true }),
      { revalidate: 300, tags: () => [], cache: cache.impl, now, random: draws(0, 0.999999, 0.5) })
    await get('a'); await get('b'); await get('c')
    expect(storedTtls(cache.store)).toEqual([270, 330, 300])
  })

  it('staleness is judged by the entry\'s own TTL, not the configured one', async () => {
    for (const [draw, ageS, refilled] of [[0, 280, true], [0.999999, 320, false]] as const) {
      clock.t = 1_000_000
      const cache = fakeNextCache(clock)
      const read = vi.fn(async () => ({ value: 1, complete: true }))
      const get = completeReadCache('k', read, { revalidate: 300, tags: () => [], cache: cache.impl, now, random: () => draw })
      await get()
      clock.t += ageS * 1000 // 280 s: stale for a 270 s entry (fresh at 300); 320 s: fresh for a 330 s one
      await get()
      await cache.settle()
      expect(read).toHaveBeenCalledTimes(refilled ? 2 : 1)
    }
  })

  it('entries filled together drift apart instead of refilling in the same minute forever', async () => {
    // Four 300 s entries filled at the same instant (a cold start), then each called every 10 s for
    // 30 minutes. With one TTL for all, all four refill in the same minute every 5 minutes, forever.
    // ±10 % spreads each cycle over a 60 s window and the phases then drift apart cycle by cycle.
    // (Random draws: whether a given cycle's refills straddle a minute boundary is luck — these
    // draws are fixed so the test is not.)
    const refills = async (random: () => number) => {
      clock.t = 0
      const cache = fakeNextCache(clock)
      const perMinute = new Map<number, number>()
      const get = completeReadCache('k', async (id: string) => {
        const m = Math.floor(clock.t / 60_000)
        perMinute.set(m, (perMinute.get(m) ?? 0) + 1)
        return { value: id, complete: true }
      }, { revalidate: 300, tags: () => [], cache: cache.impl, now, random })
      for (clock.t = 0; clock.t <= 30 * 60_000; clock.t += 10_000) {
        for (const id of ['stats', 'evaluators', 'leaderboard', 'cohort']) await get(id)
        await cache.settle()
      }
      perMinute.delete(0) // the cold fill itself
      return { worst: Math.max(...perMinute.values()), minutes: perMinute.size }
    }
    const fixed = await refills(() => 0.5)
    expect(fixed).toEqual({ worst: 4, minutes: 5 }) // every ~310 s (first call past 300 s): all four each time
    const jittered = await refills(draws(0.02, 0.37, 0.63, 0.98, 0.21, 0.84, 0.45, 0.11, 0.76, 0.3, 0.58, 0.93))
    expect(jittered.worst).toBeLessThan(4)
    expect(jittered.minutes).toBeGreaterThan(2 * fixed.minutes)
  })

  it('one read still in flight per key: concurrent callers of a stale jittered entry share one refill', async () => {
    const cache = fakeNextCache(clock)
    let release!: () => void
    let gate: Promise<void> = Promise.resolve()
    const read = vi.fn(async () => { await gate; return { value: 1, complete: true } })
    const get = completeReadCache('k', read, { revalidate: 300, tags: () => [], cache: cache.impl, now, random: () => 0 })
    await get()
    gate = new Promise<void>((r) => { release = r })
    clock.t += 280_000 // stale for its 270 s TTL
    await Promise.all([get(), get(), get()])
    release()
    await cache.settle()
    expect(read).toHaveBeenCalledTimes(2) // the fill + one shared refill
  })
})
