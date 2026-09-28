import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { currentFreshness, runWithReadLedger, setDefaultCacheImplForTests } from '../server-cache'
import { dataAgeLabel } from '../data-age'
import { fakeNextCache } from './fake-next-cache'
import { installFakeHasura, type FakeTable } from './fake-hasura'

/**
 * Etap 4b-finish commit 2 — the last reads that stored or showed failures.
 */

vi.mock('../on-chain-pricing', () => ({ getOnChainSharePrice: vi.fn(async () => null) }))

const clock = { t: Date.now() }
let cache: ReturnType<typeof fakeNextCache>
beforeEach(() => {
  cache = fakeNextCache(clock)
  setDefaultCacheImplForTests(cache.impl)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => { setDefaultCacheImplForTests(null); vi.unstubAllGlobals(); vi.restoreAllMocks() })

// ─── /leaderboard (contributors) ─────────────────────────────────────────────

const AGENT = '0xagent'
const SKILL = '0xskill'
const wallet = (i: number) => `0x${String(i).padStart(40, '0')}`
function leaderboardTables(nPositions = 3): FakeTable[] {
  return [
    { match: (q) => q.includes('LeaderboardAgents'), field: 'atoms', rows: [{ term_id: AGENT }] },
    { match: (q) => q.includes('LeaderboardSkills'), field: 'atoms', rows: [{ term_id: SKILL }] },
    { match: (q) => q.includes('LeaderboardClaims'), field: 'triples', rows: [{ term_id: '0xc1', creator_id: wallet(1) }] },
    {
      match: (q) => q.includes('LeaderboardPositions'), field: 'positions',
      rows: Array.from({ length: nPositions }, (_, i) => ({ account_id: wallet(i + 1), shares: '1', total_deposit_assets_after_total_fees: '1000000000000000000', term_id: i === 0 ? AGENT : SKILL })),
    },
    { match: (q) => q.includes('LeaderboardSignals'), field: 'signals', rows: [{ account_id: wallet(2) }] },
  ]
}

describe('/leaderboard — the shared pager and complete-reads-only cache', () => {
  it('a failed read, then a successful one within the TTL → the second caller gets data (nothing stored for the failure)', async () => {
    let fail = true
    installFakeHasura({ tables: leaderboardTables(), fail: (q) => (fail && q.includes('LeaderboardPositions') ? 'throw' : undefined) })
    const { fetchLeaderboardData } = await import('../leaderboard-data')
    await expect(fetchLeaderboardData()).rejects.toThrow()
    expect(cache.store.size).toBe(0)
    fail = false
    const entries = await fetchLeaderboardData()
    expect(entries.map((e) => e.address)).toContain(wallet(1))
    expect(cache.store.size).toBe(1)
  })

  it('a failed read rejects — the page shows an error, never "No activity found" for five minutes', async () => {
    installFakeHasura({ tables: leaderboardTables(), fail: () => 'rate-limit' })
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    const { fetchLeaderboardData } = await import('../leaderboard-data')
    const p = fetchLeaderboardData()
    const assertion = expect(p).rejects.toThrow('429')
    await vi.runAllTimersAsync()
    await assertion
    vi.useRealTimers()
  })

  it('pages past the endpoint cap: 130 positions → 130 contributors (the one-shot read would stop at 100)', async () => {
    installFakeHasura({ tables: leaderboardTables(130) })
    const { fetchLeaderboardData } = await import('../leaderboard-data')
    const entries = await fetchLeaderboardData()
    expect(entries).toHaveLength(130)
    // The registrant is the vault's first holder: wallet 1 registered the agent.
    expect(entries.find((e) => e.address === wallet(1))?.agentsRegistered).toBe(1)
  })

  it('a read past our cap (10,000 rows) fails loudly — never a silent prefix served as the leaderboard', async () => {
    const tables = leaderboardTables()
    tables[4] = { match: (q) => q.includes('LeaderboardSignals'), field: 'signals', rows: Array.from({ length: 10_001 }, (_, i) => ({ account_id: wallet(i % 7) })) }
    installFakeHasura({ tables })
    const { fetchLeaderboardData } = await import('../leaderboard-data')
    await expect(fetchLeaderboardData()).rejects.toThrow('not read to the end')
    expect(cache.store.size).toBe(0)
  })

  it('the page renders dynamically over the cache, shows the data age, and has an error state', () => {
    const page = readFileSync(path.join(__dirname, '../../app/leaderboard/page.tsx'), 'utf8')
    const client = readFileSync(path.join(__dirname, '../../components/leaderboard/LeaderboardClient.tsx'), 'utf8')
    expect(page).toMatch(/export const dynamic = 'force-dynamic'/)
    expect(page).not.toMatch(/export const revalidate/)
    expect(page).toMatch(/fetchLeaderboardData\(\)\.catch/)
    expect(client).toMatch(/data === null \? \(/)
    expect(client).toMatch(/dataAgeLabel\(dataAgeSeconds\)/)
  })

  it('dataAgeLabel', () => {
    expect(dataAgeLabel(0)).toBe('Read just now')
    expect(dataAgeLabel(42)).toBe('Data from 42 s ago')
    expect(dataAgeLabel(240)).toBe('Data from 4 min ago')
    expect(dataAgeLabel(null)).toBeNull()
  })
})

// ─── ERC-8004 agent detail from the cached cohort ────────────────────────────

const DACKIE = '0x45078ae569def2264355f77e592028dd6f1f5d6373c204fe82bf3141ab1861fb'
const OTHER = '0x0000000000000000000000000000000000000000000000000000000000000abc'
const CAIP = (n: number) => `eip155:8453/erc721:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432/${n}`
const SAME_AS = [
  { term_id: '0xsa1', created_at: '2026-07-01T00:00:00Z', subject_id: DACKIE, subject: { term_id: DACKIE, label: 'Captain Dackie' }, object: { label: CAIP(1380) } },
  { term_id: '0xsa2', created_at: '2026-07-02T00:00:00Z', subject_id: OTHER, subject: { term_id: OTHER, label: 'Other Agent' }, object: { label: CAIP(1381) } },
]
function cohortTables(opts: { classificationRows?: unknown[] } = {}): FakeTable[] {
  return [
    { match: (q) => q.includes('GetErc8004CohortAgent'), field: 'triples', rows: (_q, v) => SAME_AS.filter((r) => r.subject.term_id === v.id) },
    { match: (q) => q.includes('GetErc8004Cohort'), field: 'triples', rows: SAME_AS },
    { match: (q) => q.includes('GetCohortClassification'), field: 'triples', rows: opts.classificationRows ?? [] },
    { match: (q) => q.includes('GetAttestationTriple'), field: 'triples', rows: [] },
    { match: (q) => q.includes('VaultPositions'), field: 'positions', rows: [] },
    { match: (q) => q.includes('ApiAgents'), field: 'atoms', rows: [] },
  ]
}
const cohortListReads = (calls: Array<{ query: string }>) => calls.filter((c) => /query GetErc8004Cohort\(/.test(c.query)).length
const singleAgentReads = (calls: Array<{ query: string }>) => calls.filter((c) => c.query.includes('GetErc8004CohortAgent')).length

describe('ERC-8004 agent detail — served from the shared cached cohort', () => {
  it('repeat detail calls within the TTL cost no cohort re-read and no single-agent read; only attestations are per agent', async () => {
    const f = installFakeHasura({ tables: cohortTables() })
    const { getCohortAgentDetail } = await import('../api-data')
    const a = await getCohortAgentDetail(DACKIE)
    const b = await getCohortAgentDetail(DACKIE)
    const c = await getCohortAgentDetail(OTHER)
    expect(a).toMatchObject({ origin: 'erc8004', name: 'Captain Dackie', declaredDomains: [], trustTier: 'unverified' })
    expect(b).toEqual(a)
    expect(c?.name).toBe('Other Agent')
    expect(cohortListReads(f.calls)).toBe(1)
    expect(singleAgentReads(f.calls)).toBe(0)
  })

  it('an id not in a cohort read to the end → null, with no per-agent read', async () => {
    const f = installFakeHasura({ tables: cohortTables() })
    const { getCohortAgentDetail } = await import('../api-data')
    expect(await getCohortAgentDetail('0xnobody')).toBeNull()
    expect(singleAgentReads(f.calls)).toBe(0)
    expect(f.calls.filter((c) => c.query.includes('GetAttestationTriple'))).toHaveLength(0)
  })

  it('cohort read fails, then succeeds within the TTL → the second caller gets data from a fresh cohort read', async () => {
    let fail = true
    const f = installFakeHasura({ tables: cohortTables(), fail: (q) => (fail && /query GetErc8004Cohort\(/.test(q) ? 'throw' : undefined) })
    const { getCohortAgentDetail } = await import('../api-data')
    // The cohort couldn't answer → the live single-agent read answers this caller (never "not found").
    const first = await runWithReadLedger(async () => ({ d: await getCohortAgentDetail(DACKIE), f: currentFreshness() }))
    expect(first.d?.name).toBe('Captain Dackie')
    expect(first.f.complete).toBe(false)
    expect(singleAgentReads(f.calls)).toBe(1)
    expect([...cache.store.keys()].some((k) => k.includes('erc8004-cohort'))).toBe(false)
    fail = false
    const second = await getCohortAgentDetail(DACKIE)
    expect(second?.name).toBe('Captain Dackie')
    expect([...cache.store.keys()].some((k) => k.includes('erc8004-cohort'))).toBe(true)
  })

  it('a cohort with unread declarations is served but never stored', async () => {
    const f = installFakeHasura({ tables: cohortTables(), fail: (q) => (q.includes('GetCohortClassification') ? 'throw' : undefined) })
    const { getCohortAgentDetail } = await import('../api-data')
    const out = await runWithReadLedger(async () => ({ d: await getCohortAgentDetail(DACKIE), f: currentFreshness() }))
    expect(out.d?.declaredDomains).toBeNull()
    expect(out.f.complete).toBe(false)
    await getCohortAgentDetail(DACKIE)
    expect(cohortListReads(f.calls)).toBe(2)
  })
})
