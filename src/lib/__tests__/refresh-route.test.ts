/**
 * Etap 9d — our own writes refresh what they changed. After a trust or a withdrawal in our UI, the
 * browser calls POST /api/v1/refresh with the agent's id: exactly the reads that change can affect
 * are refilled after the response; a refill whose read fails keeps the old complete entry; the
 * route takes nothing but the id and is rate-limited per IP.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { NextRequest } from 'next/server'
import {
  completeReadCache,
  currentFreshness,
  runWithReadLedger,
  setPlatformWaitUntilForTests,
  setRefreshWriteGraceForTests,
  refreshCachedRead,
  REFRESH_MIN_INTERVAL_MS,
} from '../server-cache'
import { fakeNextCache } from './fake-next-cache'

const started = vi.hoisted(() => ({ ids: [] as string[] }))
vi.mock('../agent-refresh', async (orig) => {
  const real = await orig<typeof import('../agent-refresh')>()
  return { ...real, startAgentRefresh: (id: string) => { started.ids.push(id) } }
})

import { refreshPlan, runAgentRefresh, REFRESH_LIMIT, AGENT_ID_RE } from '../agent-refresh'
import { createRateLimiter } from '../rate-limit'
import { POST } from '../../app/api/v1/refresh/route'

const SRC = path.join(__dirname, '..', '..')
const code = (f: string) => readFileSync(path.join(SRC, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const LUDA = '0x82d87d9517b68e653418c0e49805b36aca3e33a00536af25fc319f5c24802c5a'
const COHORT = ['0xbb', '0xaa']

const clock = { t: 9_000_000 }
const now = () => clock.t
let handed: Promise<unknown>[] = []
beforeEach(() => {
  clock.t = 9_000_000
  handed = []
  setPlatformWaitUntilForTests((p) => { handed.push(p) })
  setRefreshWriteGraceForTests(0)
  started.ids = []
})
afterEach(() => {
  setPlatformWaitUntilForTests(null)
  setRefreshWriteGraceForTests(1_500)
})

/** A read whose answers the test releases one at a time (and can make incomplete or fail). */
function gatedRead() {
  let n = 0
  const gates: Array<(mode?: 'ok' | 'incomplete' | 'throw') => void> = []
  const read = vi.fn(() => new Promise<{ value: number; complete: boolean }>((resolve, reject) => {
    const v = ++n
    gates.push((mode = 'ok') => (mode === 'throw' ? reject(new Error('indexer down')) : resolve({ value: v, complete: mode === 'ok' })))
  }))
  return { read, release: (mode?: 'ok' | 'incomplete' | 'throw') => gates.shift()?.(mode) }
}

describe('the refresh triggers exactly the expected refills', () => {
  it('the agent\'s reads, the tiers parts, the attesters count and the stats; nothing else', async () => {
    const refresh = vi.fn(async (_k: string, _a: unknown[]) => 'refreshed' as const)
    const done = await runAgentRefresh(LUDA, { refresh, cohortIds: async () => COHORT })
    expect(refresh.mock.calls.map(([k, a]) => [k, a])).toEqual([
      // its own reads first, together
      ['agent-vault', [LUDA]], ['agent-attestations', [LUDA]], ['agent-trust-events', [LUDA]], ['agent-timeline', [LUDA]],
      // then the shared ones, one at a time: tiers (corpus + cohort attestations), counts (attesters), 7-day events
      ['agent-corpus', []], ['cohort-attestations', [['0xaa', '0xbb']]], ['platform-stats', []], ['trust-events-7d', []],
    ])
    expect(done.every((d) => d.outcome === 'refreshed')).toBe(true)
  })
  it('the cohort unread: everything but its attestations; a failed refill is reported as kept and the rest still run', async () => {
    const refresh = vi.fn(async (k: string) => { if (k === 'agent-corpus') throw new Error('indexer down'); return 'refreshed' as const })
    const done = await runAgentRefresh(LUDA, { refresh, cohortIds: async () => null })
    expect(done.map((d) => d.key)).not.toContain('cohort-attestations')
    expect(done.find((d) => d.key === 'agent-corpus')?.outcome).toBe('kept')
    expect(done.find((d) => d.key === 'platform-stats')?.outcome).toBe('refreshed')
  })
  it('every key in the plan is a real cached read (registered by its module)', async () => {
    const keys = refreshPlan(LUDA, COHORT).map((s) => s.key)
    const sources = ['lib/api-data.ts', 'lib/agents-page-data.ts', 'lib/trust-events.ts', 'lib/timeline-data.ts'].map(code).join('\n')
    for (const k of keys) expect(sources, k).toMatch(new RegExp(`completeReadCache\\(\\s*'${k}'`))
  })
})

describe('POST /api/v1/refresh', () => {
  const post = (body: unknown, ip = '203.0.113.7', query = '') => POST(new NextRequest(`http://localhost/api/v1/refresh${query}`, {
    method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers: { 'content-type': 'application/json', 'x-forwarded-for': `${ip}, 10.0.0.1` },
  }))

  it('202 and the refresh started for that agent; it accepts the id and nothing else', async () => {
    const res = await post({ agentId: LUDA, attesters: 999, value: 'x' }, '203.0.113.1')
    expect(res.status).toBe(202)
    const json = await res.json()
    expect(json.data).toMatchObject({ accepted: true, agentId: LUDA })
    expect(started.ids).toEqual([LUDA])
    expect(res.headers.get('cache-control')).toBe('no-store')
    // The route reads `agentId` alone: no other field reaches anything.
    expect(code('app/api/v1/refresh/route.ts')).not.toMatch(/body\??\.(?!agentId)\w+/)
  })
  it('400 for anything that is not a term id; nothing starts', async () => {
    for (const bad of [{}, { agentId: 'luda' }, { agentId: `${LUDA}00` }, 'not json']) {
      expect((await post(bad, '203.0.113.2')).status).toBe(400)
    }
    expect(started.ids).toEqual([])
    expect(AGENT_ID_RE.test(LUDA)).toBe(true)
  })
  it('a burst over the limit from one IP gets 429 with Retry-After; another IP is not held back', async () => {
    const statuses: number[] = []
    for (let i = 0; i < REFRESH_LIMIT.limit + 1; i++) statuses.push((await post({ agentId: LUDA }, '198.51.100.9')).status)
    expect(statuses).toEqual([...Array(REFRESH_LIMIT.limit).fill(202), 429])
    const over = await post({ agentId: LUDA }, '198.51.100.9')
    expect(over.headers.get('retry-after')).toMatch(/^\d+$/)
    expect((await post({ agentId: LUDA }, '198.51.100.10')).status).toBe(202)
    expect(REFRESH_LIMIT).toEqual({ limit: 6, windowMs: 60_000 })
  })
  it('the limit is a sliding minute', () => {
    const t = { v: 0 }
    const l = createRateLimiter({ limit: 2, windowMs: 60_000, now: () => t.v })
    expect([l.take('a').ok, l.take('a').ok, l.take('a').ok]).toEqual([true, true, false])
    t.v = 60_001
    expect(l.take('a').ok).toBe(true)
  })
})

describe('the UI calls it after a confirmed trust or withdrawal', () => {
  it('trust (AttestButton) and withdraw (YourTrust) call requestRefresh after the receipt', () => {
    expect(code('components/attest/AttestButton.tsx')).toMatch(/setStatus\('success'\)[\s\S]{0,200}requestRefresh\(agentId\)|requestRefresh\(agentId\)[\s\S]{0,200}setStatus\('success'\)/)
    expect(code('components/trust/YourTrust.tsx')).toMatch(/receipt\.status !== 'success'[\s\S]*requestRefresh\(agentId\)/)
    expect(code('lib/refresh-client.ts')).toMatch(/method: 'POST'/)
  })
})

describe('refresh: a fresh complete read over the entry, or the old entry kept', () => {
  it('refreshed: the next caller gets the new read with age 0, though the entry was within its TTL', async () => {
    const cache = fakeNextCache(clock)
    const { read, release } = gatedRead()
    const get = completeReadCache('k', read, { revalidate: 300, tags: () => [], cache: cache.impl, now })
    const fill = get(); release(); await fill
    clock.t += 30_000 // fresh: a visitor would not refill it

    const r = get.refresh(); await new Promise((r) => setTimeout(r, 0)); release()
    expect(await r).toBe('refreshed')
    expect(handed.length).toBeGreaterThan(0) // the refresh's read was kept alive too
    expect(await runWithReadLedger(async () => ({ v: await get(), f: currentFreshness(clock.t) }))).toMatchObject({ v: 2, f: { dataAgeSeconds: 0 } })
  })

  it('a refresh whose read is incomplete, or fails, keeps the old complete entry', async () => {
    const cache = fakeNextCache(clock)
    const { read, release } = gatedRead()
    const get = completeReadCache('k2', read, { revalidate: 300, tags: () => [], cache: cache.impl, now })
    const fill = get(); release(); await fill

    clock.t += 30_000
    const a = get.refresh(); await new Promise((r) => setTimeout(r, 0)); release('incomplete')
    expect(await a).toBe('kept')
    clock.t += REFRESH_MIN_INTERVAL_MS
    const b = get.refresh(); await new Promise((r) => setTimeout(r, 0)); release('throw')
    expect(await b).toBe('kept')

    const answer = await runWithReadLedger(async () => ({ v: await get(), f: currentFreshness(clock.t) }))
    expect(answer.v).toBe(1) // the first complete read, still served
    expect(answer.f.complete).toBe(true)
  })

  it('at most one refresh per key per interval on an instance; by key name through refreshCachedRead', async () => {
    const cache = fakeNextCache(clock)
    const read = vi.fn(async () => ({ value: 1, complete: true }))
    const get = completeReadCache('named-key', read, { revalidate: 300, tags: () => [], cache: cache.impl, now })
    await get()
    expect(await refreshCachedRead('named-key')).toBe('refreshed')
    expect(await refreshCachedRead('named-key')).toBe('skipped')
    clock.t += REFRESH_MIN_INTERVAL_MS
    expect(await get.refresh()).toBe('refreshed')
    expect(read).toHaveBeenCalledTimes(3)
    expect(await refreshCachedRead('no-such-key')).toBe('kept')
  })
})
