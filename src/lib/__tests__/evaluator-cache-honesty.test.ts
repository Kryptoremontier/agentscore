import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { currentFreshness, runWithReadLedger, setDefaultCacheImplForTests } from '../server-cache'
import { fakeNextCache } from './fake-next-cache'

/**
 * The evaluator leaderboard was already cached (unstable_cache, 300 s) — and cached its failures:
 * any error (a 429 included: the local transport read `{ message }` as "no data") returned `[]`,
 * stored and served as "no evaluators" for five minutes. Its positions read asked for 800 rows
 * and got at most 100. The attestation gate stored a failed count as 0 attestations for 5 minutes.
 */

const AGENT = '0x82d87d9517b68e653418c0e49805b36aca3e33a00536af25fc319f5c24802c5a'
const WALLET = '0x139219107c1ebe569f543c581b3b807cf6740006'

// Each test's evaluator wallets are distinct: the attestation gate keeps successful counts in memory.
let walletSeed = 1_000
function stubIndexer(opts: { positionsFail?: boolean; attestationFail?: () => boolean; positions?: number; attestationRows?: number } = {}) {
  const seed = (walletSeed += 1_000)
  const calls: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (_url: unknown, init?: RequestInit) => {
    const q = String(JSON.parse(String(init?.body ?? '{}')).query)
    calls.push(q)
    const rateLimited = { ok: false, status: 429, json: async () => ({ message: 'API rate limit exceeded' }) }
    if (opts.positionsFail && q.includes('EvaluatorPositions')) return rateLimited
    if (q.includes('object: { creator') && opts.attestationFail?.()) return rateLimited
    const n = opts.positions ?? 1
    const position = (i: number) => ({
      id: `p${String(i).padStart(4, '0')}`, account_id: `0x${String(seed + i).padStart(40, '0')}`, shares: '1000', term_id: AGENT,
      total_deposit_assets_after_total_fees: '1000', total_redeem_assets_for_receiver: '0',
      vault: { current_share_price: '1', term: { atom: { term_id: AGENT, label: 'Luda', creator: null, positions_aggregate: { aggregate: { sum: { shares: '1000' } } }, as_subject_triples: [] } } },
    })
    // A paged read's first page carries its count in the same document (lib/gql-pager.ts).
    const data = q.includes('EvaluatorAgentIds') ? { atoms: [{ term_id: AGENT }], atoms_aggregate: { aggregate: { count: 1 } } }
      : q.includes('EvaluatorPositions') ? (() => {
        const body = JSON.parse(String(init?.body))
        const { limit, offset } = body.variables
        return {
          positions: Array.from({ length: Math.max(0, Math.min(limit, 100, n - offset)) }, (_, i) => position(offset + i)),
          positions_aggregate: { aggregate: { count: n } },
        }
      })()
      : q.includes('object: { creator') ? { triples: Array.from({ length: opts.attestationRows ?? 0 }, (_, i) => ({ subject: { creator: { id: `0x${String(i + 1).padStart(40, '0')}` } } })) }
      // Everything else answers empty (and complete): an empty corpus, no domains, zero counts.
      : { positions: [], atoms: [], triples: [], atoms_aggregate: { aggregate: { count: 0 } }, triples_aggregate: { aggregate: { count: 0 } }, positions_aggregate: { aggregate: { count: 0 } } }
    return { ok: true, status: 200, json: async () => ({ data }) }
  }))
  return calls
}

const clock = { t: Date.now() }
let cache: ReturnType<typeof fakeNextCache>
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout'] })
  cache = fakeNextCache(clock)
  setDefaultCacheImplForTests(cache.impl)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => { setDefaultCacheImplForTests(null); vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks() })

async function settle<T>(p: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync()
  return p
}

describe('evaluator leaderboard — a failure is a failure, never a cached empty list', () => {
  it('positions read rate-limited → rejects (was: [] stored for 5 minutes); nothing stored', async () => {
    stubIndexer({ positionsFail: true })
    const { fetchEvaluatorLeaderboard } = await import('../evaluator-data')
    const p = fetchEvaluatorLeaderboard()
    const assertion = expect(p).rejects.toThrow('429')
    await vi.runAllTimersAsync()
    await assertion
    expect(cache.store.size).toBe(0)
  })

  it('pages past the endpoint’s 100-row cap (was one `limit: 800` read → at most 100)', async () => {
    stubIndexer({ positions: 130 })
    const { fetchEvaluatorLeaderboard } = await import('../evaluator-data')
    const profiles = await settle(fetchEvaluatorLeaderboard())
    // One profile per distinct wallet; the top 50 are kept — but all 130 positions were read.
    expect(profiles.length).toBe(50)
    expect(cache.store.size).toBe(1)
  })

  it('an attestation count that failed → the leaderboard answers but is not stored; the next call re-reads', async () => {
    let fail = true
    stubIndexer({ attestationFail: () => fail })
    const { fetchEvaluatorLeaderboard } = await import('../evaluator-data')
    const f1 = await settle(runWithReadLedger(async () => { await fetchEvaluatorLeaderboard(); return currentFreshness() }))
    expect(f1.complete).toBe(false)
    expect(cache.store.size).toBe(0)
    fail = false
    const f2 = await settle(runWithReadLedger(async () => { await fetchEvaluatorLeaderboard(); return currentFreshness() }))
    expect(f2.complete).toBe(true)
    expect(cache.store.size).toBe(1)
  })
})

describe('attestation gate — a failed count is not cached as 0', () => {
  it('failure → incomplete, and the next call asks again (was: 0 attestations for 5 minutes)', async () => {
    let fail = true
    const calls = stubIndexer({ attestationFail: () => fail })
    const { getAttestationCount } = await import('../attestation-gate')
    const first = await getAttestationCount(WALLET)
    expect(first.incomplete).toBe(true)
    fail = false
    const second = await getAttestationCount(WALLET)
    expect(second.incomplete).toBeUndefined()
    expect(calls.filter((q) => q.includes('object: { creator')).length).toBe(2)
  })
})

describe('attestation gate — a count at the endpoint’s row cap is not known complete', () => {
  it('250 rows (the `triples` cap; `limit: 500` asked) → incomplete, not cached', async () => {
    const calls = stubIndexer({ attestationRows: 250 })
    const { getAttestationCount } = await import('../attestation-gate')
    const wallet = '0x2222222222222222222222222222222222222222'
    expect((await getAttestationCount(wallet)).incomplete).toBe(true)
    await getAttestationCount(wallet)
    expect(calls.filter((q) => q.includes('object: { creator')).length).toBe(2)
  })
})

describe('stats: a failed leaderboard is null evaluators, and the answer is incomplete', () => {
  it('evaluators null, response not cacheable', async () => {
    stubIndexer({ positionsFail: true })
    const { getPlatformStats } = await import('../api-data')
    const out = await settle(runWithReadLedger(async () => ({ stats: await getPlatformStats(), f: currentFreshness() })))
    expect(out.stats.evaluators).toBeNull()
    expect(out.f.complete).toBe(false)
  })
})
