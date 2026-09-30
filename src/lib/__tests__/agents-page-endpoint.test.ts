import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { setDefaultCacheImplForTests } from '../server-cache'
import { decodeFromCache } from '../json-codec'
import { feedFreshnessLabel, partIsStale, type AgentModalPayload, type AgentsPagePayload } from '../agents-page-types'
import type { EvaluatorProfile } from '../evaluator-score'
import { fakeNextCache } from './fake-next-cache'
import { installFakeHasura, type FakeTable } from './fake-hasura'

/**
 * Etap 4c commit 1 — GET /api/v1/agents/page and /api/v1/agents/page/:id: the /agents page's
 * reads through the shared complete-reads cache. Production 29.09 05:37 UTC: the page (browser →
 * indexer) showed "Error: Load failed" while /api/v1/stats answered from a 110 s old complete read.
 */

vi.mock('../on-chain-pricing', () => ({ getOnChainSharePrice: vi.fn(async () => null) }))
const leaderboard = vi.fn<() => Promise<EvaluatorProfile[]>>(async () => [])
vi.mock('../evaluator-data', async (orig) => ({
  ...(await orig<typeof import('../evaluator-data')>()),
  fetchEvaluatorLeaderboard: () => leaderboard(),
}))

const LUDA = '0x82d87d9517b68e653418c0e49805b36aca3e33a00536af25fc319f5c24802c5a'
const OPEN_CLAW = '0x0d579846f21a66f35efafb2339d182e27560ec9f9d8ea64f7f1d9929d20a2d7d'
const OC_TRIPLE = '0x878e39f7a99f4646d35896a515616f7957a9b412a7fe351c459c8eec36e24508'
const OC_COUNTER = '0xfbd687182999fc0e358820da5e11be79b3a1f6ecca5c175fefcb6b89ef16e1a7'
const DACKIE = '0x45078ae569def2264355f77e592028dd6f1f5d6373c204fe82bf3141ab1861fb'
const STAKER = '0x139219107C1eBE569f543C581b3B807Cf6740006'
const row = (term_id: string, label: string, shares: string, triple?: [string, string]) => ({
  term_id, label, data: null, type: 'Thing', emoji: null, created_at: '2026-03-01T00:00:00+00:00',
  creator: { label: 'x', id: '0x0' },
  positions_aggregate: { aggregate: { sum: { shares }, max: { created_at: '2026-03-01T00:00:00+00:00' } } },
  as_subject_triples: triple ? [{ term_id: triple[0], counter_term_id: triple[1] }] : [],
})
const CORPUS = [row(LUDA, '{"name":"Luda"}', '980000000000000'), row(OPEN_CLAW, 'Agent: OPEN CLAW from Kryptoremontier - test', '335061000000000000', [OC_TRIPLE, OC_COUNTER])]
const POSITIONS = [
  { id: `${OPEN_CLAW}-1-${STAKER}`, term_id: OPEN_CLAW, account_id: STAKER, shares: '335061000000000000', created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z', account: { label: 'x' } },
  { id: `${OC_COUNTER}-1-0xabc`, term_id: OC_COUNTER, account_id: '0x00000000000000000000000000000000000abc01', shares: '1000', created_at: '2026-03-02T00:00:00Z', updated_at: '2026-03-02T00:00:00Z', account: { label: 'y' } },
]
const CAIP = 'eip155:8453/erc721:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432/1380'
const SAME_AS = [{ term_id: '0xsa1', created_at: '2026-07-01T00:00:00Z', subject_id: DACKIE, subject: { term_id: DACKIE, label: 'Captain Dackie' }, object: { label: CAIP } }]

const indexer = { down: false, cohortDown: false }
function tables(): FakeTable[] {
  return [
    { match: (q) => q.includes('ApiAgents'), field: 'atoms', rows: CORPUS },
    { match: (q) => q.includes('FindTrustTriple'), field: 'triples', rows: (_q, v) => (v.subjectId === OPEN_CLAW ? [{ term_id: OC_TRIPLE, counter_term_id: OC_COUNTER }] : []) },
    { match: (q) => q.includes('VaultPositions'), field: 'positions', rows: (_q, v) => POSITIONS.filter((p) => (v.vaultIds as string[] | undefined)?.includes(p.term_id) ?? true) },
    { match: (q) => q.includes('GetAttestationTriple'), field: 'triples', rows: [] },
    { match: (q) => /query GetErc8004Cohort[(R]/.test(q), field: 'triples', rows: SAME_AS },
    { match: (q) => q.includes('GetErc8004CohortCount'), field: 'triples', rows: SAME_AS },
    { match: (q) => q.includes('GetCohortClassification'), field: 'triples', rows: [] },
    { match: (q) => q.includes('GetSignals'), field: 'signals', rows: [{ id: 's1', delta: '1', account_id: STAKER, term_id: OPEN_CLAW, created_at: '2026-03-01T00:00:00Z', deposit_id: 'd', redemption_id: null }] },
    { match: (q) => q.includes('GetAgentAllTriples') || q.includes('SkillTriples'), field: 'triples', rows: [] },
    { match: (q) => q.includes('GetAgentReport'), field: 'triples', rows: [] },
  ]
}

const clock = { t: Date.UTC(2026, 8, 29, 5, 30) }
let cache: ReturnType<typeof fakeNextCache>
let hasura: ReturnType<typeof installFakeHasura>
const advance = async (ms: number) => { clock.t += ms; vi.setSystemTime(clock.t); await cache.settle() }

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(clock.t)
  cache = fakeNextCache(clock)
  setDefaultCacheImplForTests(cache.impl)
  indexer.down = false
  indexer.cohortDown = false
  leaderboard.mockResolvedValue([])
  hasura = installFakeHasura({
    tables: tables(),
    other: (q) => (q.includes('signals_aggregate') ? {} : undefined),
    fail: (q) => (indexer.down ? 'throw' : indexer.cohortDown && /Erc8004Cohort|CohortClassification/.test(q) ? 'throw' : undefined),
  })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => { setDefaultCacheImplForTests(null); vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks() })

async function page(): Promise<{ status: number; cacheControl: string | null; body: AgentsPagePayload }> {
  const { GET } = await import('@/app/api/v1/agents/page/route')
  const res = await GET()
  const json = await res.json()
  return { status: res.status, cacheControl: res.headers.get('cache-control'), body: decodeFromCache<AgentsPagePayload>(json.data) }
}

async function modal(id: string, parts?: string): Promise<{ status: number; body: AgentModalPayload | null }> {
  const { GET } = await import('@/app/api/v1/agents/page/[id]/route')
  const res = await GET(new NextRequest(`http://localhost/api/v1/agents/page/${id}${parts != null ? `?parts=${parts}` : ''}`), { params: Promise.resolve({ id }) })
  const json = await res.json()
  return { status: res.status, body: json.success ? decodeFromCache<AgentModalPayload>(json.data) : null }
}

describe('GET /api/v1/agents/page — the list in one answer, part by part', () => {
  it('everything read → three parts, live, with the list rows, their vault snapshot and exact wei; CDN-cacheable', async () => {
    const { status, cacheControl, body } = await page()
    expect(status).toBe(200)
    expect(cacheControl).toBe('public, s-maxage=15, stale-while-revalidate=30')
    expect(body.agentScore).toMatchObject({ status: 'ok', complete: true, dataAgeSeconds: 0, staleAfterSeconds: 2 * 60 + 45 })
    const a = body.agentScore.status === 'ok' ? body.agentScore.value : null
    expect(a?.rows.map((r) => r.term_id)).toEqual([LUDA, OPEN_CLAW])
    const oc = a!.rows[1]
    // The trust triple with its own vault id (the modal opens on it), oppose wei as a bigint.
    expect(oc.as_subject_triples).toEqual([{ term_id: OC_TRIPLE, counter_term_id: OC_COUNTER }])
    expect(hasura.calls.find((c) => c.query.includes('ApiAgents'))!.query).toMatch(/limit: 1\s*\)\s*\{\s*term_id counter_term_id\s*\}/)
    expect(oc.__opposeWei).toBe(1000n)
    expect(oc.liveStakerCount).toBe(2)
    expect(oc.__vaultPositions).toHaveLength(2)
    expect(oc.__vaultReadAt).toBe(clock.t)
    expect(a).toMatchObject({ junk: 0, fetched: 2, total: 2, truncated: false })
    expect(Object.keys(a!.attestations!)).toEqual(expect.arrayContaining([LUDA, OPEN_CLAW]))
    expect(body.cohort).toMatchObject({ status: 'ok', value: { total: 1, truncated: false } })
    expect(body.cohortAttestations).toMatchObject({ status: 'ok', value: { [DACKIE]: [] } })
    expect(feedFreshnessLabel([body.agentScore, body.cohort, body.cohortAttestations], 'GraphQL live feed', clock.t)).toBe('GraphQL live feed')
  })

  it('indexer down, cache cold → every part failed: no rows, no counts standing in for them; not cacheable', async () => {
    indexer.down = true
    const { status, cacheControl, body } = await page()
    expect(status).toBe(200)
    expect(cacheControl).toBe('no-store')
    expect(body).toEqual({ agentScore: { status: 'failed' }, cohort: { status: 'failed' }, cohortAttestations: { status: 'failed' } })
    expect(feedFreshnessLabel([body.agentScore, body.cohort], 'GraphQL live feed', clock.t)).toBeNull()
  })

  it('indexer down, cache warm → the last complete read with its real age, flagged stale past twice its TTL', async () => {
    await page()
    indexer.down = true
    await advance(3 * 60_000) // corpus TTL 60 s: past 2 × TTL + the CDN window
    const { status, body } = await page()
    expect(status).toBe(200)
    expect(body.agentScore).toMatchObject({ status: 'ok', dataAgeSeconds: 180 })
    expect(body.agentScore.status === 'ok' && body.agentScore.value.rows).toHaveLength(2)
    expect(partIsStale(body.agentScore, clock.t)).toBe(true)
    // The cohort (TTL 300 s) is still within its normal age: served, not stale.
    expect(body.cohort).toMatchObject({ status: 'ok', dataAgeSeconds: 180 })
    expect(partIsStale(body.cohort, clock.t)).toBe(false)
    expect(feedFreshnessLabel([body.agentScore, body.cohort, body.cohortAttestations], 'GraphQL live feed', clock.t)).toBe('Updated 3 min ago')
  })

  it('one part failed, the other live → that part says so, the rest is served', async () => {
    indexer.cohortDown = true
    const { cacheControl, body } = await page()
    expect(body.agentScore).toMatchObject({ status: 'ok', complete: true })
    expect(body.cohort).toEqual({ status: 'failed' })
    expect(body.cohortAttestations).toEqual({ status: 'failed' })
    expect(cacheControl).toBe('no-store') // the next request retries the cohort
  })
})

describe('GET /api/v1/agents/page/:id — the modal beyond the list', () => {
  it('vault (trust triple + raw positions), signals, skill triples, reports, staker weights from the evaluator leaderboard', async () => {
    leaderboard.mockResolvedValue([{ address: STAKER.toLowerCase(), evaluatorWeight: 0.623 } as EvaluatorProfile])
    const { status, body } = await modal(OPEN_CLAW)
    expect(status).toBe(200)
    expect(body!.vault).toMatchObject({ status: 'ok', value: { trustTriple: { termId: OC_TRIPLE, counterTermId: OC_COUNTER } } })
    expect(body!.vault.status === 'ok' && body!.vault.value.positions).toHaveLength(2)
    expect(body!.signals).toMatchObject({ status: 'ok', value: { totalCount: 1 } })
    expect(body!.reports).toMatchObject({ status: 'ok', value: [] })
    // The counter-vault's wallet has no position on an agent: a newcomer's weight (the leaderboard holds everyone).
    expect(body!.stakerWeights).toMatchObject({ status: 'ok', value: { [STAKER.toLowerCase()]: 0.623, '0x00000000000000000000000000000000000abc01': 1 } })
  })

  it('trust triple unread → no signals either (which vaults to read is unknown — never the atom\'s alone)', async () => {
    await page()
    const f = installFakeHasura({ tables: tables(), fail: (q) => (q.includes('FindTrustTriple') ? 'throw' : undefined) })
    const { body } = await modal(OPEN_CLAW)
    expect(body!.vault).toEqual({ status: 'failed' })
    expect(body!.signals).toEqual({ status: 'failed' })
    expect(body!.stakerWeights).toEqual({ status: 'failed' })
    expect(body!.reports).toMatchObject({ status: 'ok' })
    expect(f.calls.some((c) => c.query.includes('GetSignals'))).toBe(false)
  })

  it('an id the page does not list → 404, no reads for it; a malformed id → 400', async () => {
    expect((await modal('0x' + 'de'.repeat(32))).status).toBe(404)
    expect((await modal('0xnot-an-id')).status).toBe(400)
  })

  it('indexer down, cache cold → every part failed (never an empty history or 0 reports)', async () => {
    await page() // the lists are cached: OPEN CLAW is known
    indexer.down = true
    const { status, body } = await modal(OPEN_CLAW)
    expect(status).toBe(200)
    expect(Object.values(body!).every((p) => p.status === 'failed')).toBe(true)
  })
})

describe('GET /api/v1/agents/page/:id?parts= — the header never waits on the slow parts (Etap 5a)', () => {
  it('?parts=vault,signals,reports → only those, and no skill-triple or leaderboard read behind them', async () => {
    await page()
    hasura.calls.length = 0
    leaderboard.mockClear()
    const { status, body } = await modal(OPEN_CLAW, 'vault,signals,reports')
    expect(status).toBe(200)
    expect(Object.keys(body!).sort()).toEqual(['reports', 'signals', 'vault'])
    expect(body!.vault.status).toBe('ok')
    expect(hasura.calls.some((c) => /GetAgentAllTriples/.test(c.query))).toBe(false)
    expect(leaderboard).not.toHaveBeenCalled()
  })

  it('?parts=skillTriples → only that; no parts = every part (the 4c contract); an unknown part → 400', async () => {
    await page()
    expect(Object.keys((await modal(OPEN_CLAW, 'skillTriples')).body!)).toEqual(['skillTriples'])
    expect(Object.keys((await modal(OPEN_CLAW)).body!).sort()).toEqual(['reports', 'signals', 'skillTriples', 'stakerWeights', 'vault'])
    expect((await modal(OPEN_CLAW, 'vault,bogus')).status).toBe(400)
    expect((await modal(OPEN_CLAW, '')).status).toBe(200) // empty = default: every part
  })

  it('the modal\'s age line ignores parts not answered yet', async () => {
    const { modalFreshnessLabel } = await import('../agents-page-types')
    await page()
    await modal(OPEN_CLAW)
    indexer.down = true
    await advance(3 * 60_000)
    const header = (await modal(OPEN_CLAW, 'vault,signals,reports')).body!
    expect(modalFreshnessLabel(null, header, false, clock.t)).toBe('Updated 3 min ago')
    expect(modalFreshnessLabel(null, {}, false, clock.t)).toBeNull()
  })
})

describe('stakerWeightsFrom — a wallet is weighed only when its weight is known', () => {
  it('in the leaderboard → its weight; absent from a leaderboard holding everyone → a newcomer; absent from a cut one → unknown', async () => {
    const { stakerWeightsFrom } = await import('../agents-page-data')
    const { EVALUATOR_LEADERBOARD_MAX } = await import('../evaluator-data')
    const p = (address: string, evaluatorWeight: number) => ({ address, evaluatorWeight }) as EvaluatorProfile
    expect(stakerWeightsFrom([p('0xAa', 1.2)], ['0xaa', '0xbb'])).toEqual({ '0xaa': 1.2, '0xbb': 1 })
    const full = Array.from({ length: EVALUATOR_LEADERBOARD_MAX }, (_, i) => p(`0x${i}`, 1))
    expect(() => stakerWeightsFrom(full, ['0xbb'])).toThrow('unknown')
  })
})

// ─── Commit 3: what the page shows in each indexer state ─────────────────────

describe('/agents in each indexer state — what a visitor sees (Etap 4c)', () => {
  /** The header line exactly as the page builds it (app/agents/page.tsx: corpusCounts + freshness). */
  const headerOf = async (view: import('../agents-page-types').AgentsPageView) => {
    const { agentListHeaderSegments, LIVE_FEED_LABEL } = await import('../agent-list')
    const a = view.agentScore, c = view.cohort
    return agentListHeaderSegments({
      agentScore: a.status === 'ok'
        ? { status: 'ok', kept: a.rows.length, junk: a.junk, fetched: a.fetched, total: a.total, truncated: a.truncated }
        : { status: 'error', kept: 0, junk: 0, fetched: 0, total: null, truncated: null },
      cohort: c.status === 'ok' ? { status: 'ok', count: c.agents.length, total: c.total, truncated: c.truncated } : { status: 'error', count: 0, total: null, truncated: null },
      freshness: feedFreshnessLabel(view.parts, LIVE_FEED_LABEL, clock.t),
    })
  }

  it('indexer down, cache warm → the last read, "Updated 3 min ago" in the header, no error box', async () => {
    const { agentsPageView } = await import('../agents-page-types')
    await page()
    indexer.down = true
    await advance(3 * 60_000)
    const view = agentsPageView((await page()).body)
    expect(view.unreachable).toBe(false)
    expect(view.agentScore.status === 'ok' && view.agentScore.rows.map((r) => r.term_id)).toEqual([LUDA, OPEN_CLAW])
    expect(view.cohort.status).toBe('ok')
    const header = await headerOf(view)
    expect(header).toEqual(['2 AgentScore', '1 ERC-8004', 'Updated 3 min ago'])
  })

  it('indexer down, cache warm → the modal says the age too (on a phone it covers the header)', async () => {
    const { agentsPageView, modalFreshnessLabel } = await import('../agents-page-types')
    await page()
    await modal(OPEN_CLAW)
    expect(modalFreshnessLabel(agentsPageView((await page()).body), (await modal(OPEN_CLAW)).body, false, clock.t)).toBeNull() // live: no line
    indexer.down = true
    await advance(3 * 60_000)
    const body = (await modal(OPEN_CLAW)).body!
    expect(Object.values(body).every((p) => p.status === 'ok')).toBe(true) // the last complete reads, not failures
    expect(modalFreshnessLabel(agentsPageView((await page()).body), body, false, clock.t)).toBe('Updated 3 min ago')
    expect(modalFreshnessLabel(null, body, false, clock.t)).toBe('Updated 3 min ago') // its own parts alone say so
  })

  it('the modal\'s age line: after the user\'s own trade its live-read parts don\'t count; a failed part never does', async () => {
    const { modalFreshnessLabel } = await import('../agents-page-types')
    const part = (ageSeconds: number, staleAfterSeconds: number) => ({
      status: 'ok' as const, value: null, dataReadAt: new Date(clock.t - ageSeconds * 1000).toISOString(),
      dataAgeSeconds: ageSeconds, complete: true, staleAfterSeconds,
    })
    const old = part(200, 105), fresh = part(10, 105)
    const m = { vault: old, signals: old, reports: old, skillTriples: fresh, stakerWeights: fresh } as unknown as AgentModalPayload
    expect(modalFreshnessLabel({ parts: [part(10, 165)] }, m, false, clock.t)).toBe('Updated 3 min ago')
    expect(modalFreshnessLabel({ parts: [part(10, 165)] }, m, true, clock.t)).toBeNull() // vault, signals, reports read live
    expect(modalFreshnessLabel({ parts: [part(200, 165)] }, m, true, clock.t)).toBe('Updated 3 min ago') // the row itself is old
    const failed = { vault: { status: 'failed' }, signals: { status: 'failed' }, reports: { status: 'failed' }, skillTriples: { status: 'failed' }, stakerWeights: { status: 'failed' } } as AgentModalPayload
    expect(modalFreshnessLabel(null, failed, false, clock.t)).toBeNull()
  })

  it('indexer down, cache cold → the human error, and no zeros: no rows, "—" counts, "unavailable" segments', async () => {
    const { agentsPageView, FEED_UNREACHABLE } = await import('../agents-page-types')
    const { corpusTotals, qualityOptions, qualityOptionText } = await import('../agent-list')
    indexer.down = true
    const view = agentsPageView((await page()).body)
    expect(view.unreachable).toBe(true)
    expect(view.agentScore).toEqual({ status: 'error' })
    expect(view.attestations).toBeNull()
    expect(FEED_UNREACHABLE).toBe('Can’t reach the Intuition network right now. Try again in a minute.')
    expect(await headerOf(view)).toEqual(['AgentScore feed unavailable', 'ERC-8004 feed unavailable'])
    const tabs = corpusTotals({
      agentScore: { status: 'error', kept: 0, junk: 0, fetched: 0, total: null, truncated: null },
      cohort: { status: 'error', count: 0, total: null, truncated: null },
    })
    expect(tabs).toEqual({ all: null, agentscore: null, erc8004: null }) // printed "—"
    expect(qualityOptions(null).map(qualityOptionText)[0]).toBe('All backing levels') // no count
    // Our own API unreachable altogether (offline) → the same.
    expect(agentsPageView(null)).toMatchObject({ unreachable: true, agentScore: { status: 'error' }, cohort: { status: 'error' }, attestations: null })
  })

  it('one part failed, the other live → that part says so, the rest renders (its attester lines included)', async () => {
    const { agentsPageView } = await import('../agents-page-types')
    const { attesterLineOf, cardAttestationView } = await import('../agent-list')
    indexer.cohortDown = true
    const view = agentsPageView((await page()).body)
    expect(view.unreachable).toBe(false)
    expect(await headerOf(view)).toEqual(['2 AgentScore', 'ERC-8004 feed unavailable'])
    const views = new Map([...view.attestations!].map(([id, e]) => [id, cardAttestationView(e)]))
    expect(attesterLineOf(views, OPEN_CLAW).kind).toBe('none') // read: no attestation
    expect(attesterLineOf(views, DACKIE).kind).toBe('unread') // its part failed: no claim
  })

  it('post-trade: the user\'s own position shows live even when the cached list is stale', async () => {
    const { agentsPageView, isLiveAfterOwnTx, OWN_TX_LIVE_MS } = await import('../agents-page-types')
    const { withLiveVault, listVaultSnapshot, listOpposeWei } = await import('../agent-list')
    const { readSharesWei } = await import('../score-basis')
    await page()
    indexer.down = true
    await advance(3 * 60_000) // the list is served from a 3-minute-old read
    const view = agentsPageView((await page()).body)
    const stale = view.agentScore.status === 'ok' ? view.agentScore.rows[1] : null
    expect(readSharesWei(stale!.positions_aggregate)).toBe(335061000000000000n)

    // The user buys 1 share-unit's worth; the live read after the trade (the browser, not the cache):
    const ME = '0x00000000000000000000000000000000000000ee'
    const live = [...POSITIONS, { id: `${OPEN_CLAW}-1-${ME}`, term_id: OPEN_CLAW, account_id: ME, shares: '1000000000000000000', created_at: '2026-09-29T05:33:00Z', updated_at: '2026-09-29T05:33:00Z', account: { label: 'me' } }]
    const row = withLiveVault(stale!, live, clock.t)
    expect(readSharesWei(row.positions_aggregate)).toBe(1335061000000000000n)
    expect(row.liveStakerCount).toBe(3)
    expect(listVaultSnapshot(row)?.positions.some((p) => p.account_id === ME)).toBe(true)
    expect(listOpposeWei(row)).toBe(1000n)
    expect(stale!.liveStakerCount).toBe(2) // the cached row itself is untouched
    // The oppose side fully redeemed since the cached read: its row is gone → 0, not the cached 1000.
    expect(listOpposeWei(withLiveVault(stale!, live.filter((p) => p.term_id !== OC_COUNTER), clock.t))).toBe(0n)

    // The agent's reads stay live for OWN_TX_LIVE_MS, longer than the cached answers can lag.
    const until = { [OPEN_CLAW]: clock.t + OWN_TX_LIVE_MS }
    expect(isLiveAfterOwnTx(until, OPEN_CLAW, clock.t + 4 * 60_000)).toBe(true)
    expect(isLiveAfterOwnTx(until, OPEN_CLAW, clock.t + OWN_TX_LIVE_MS + 1)).toBe(false)
    expect(isLiveAfterOwnTx(until, LUDA, clock.t)).toBe(false)
    expect(OWN_TX_LIVE_MS / 1000).toBeGreaterThan(2 * 30 + 45) // agent parts: 2 × TTL + the CDN window
  })

  it('the page wires it so (source guards — no DOM here)', async () => {
    const { readFileSync } = await import('node:fs')
    const path = await import('node:path')
    const src = readFileSync(path.join(__dirname, '../../app/agents/page.tsx'), 'utf8')
    // No indexer read from the browser for the list: one API answer.
    expect(src).toMatch(/await fetchAgentsPage\(\)/)
    expect(src).not.toMatch(/fetchAgentListCorpus|fetchAttestationsForSubjects\(|fetchCohortAgents|useAgentStakerWeights/)
    // The error box: only when nothing is readable, human copy, no "Error:".
    expect(src).toMatch(/\{!loading && pageView\?\.unreachable && \(/)
    expect(src).toMatch(/<p className="text-red-400">\{FEED_UNREACHABLE\}<\/p>/)
    expect(src).not.toMatch(/Error: \{error\}/)
    // After the user's own trade: that agent live, its row patched — not the whole list re-read.
    const vote = src.slice(src.indexOf('const executeVote = async'), src.indexOf('// Create the trust triple for the selected agent'))
    expect(vote).toMatch(/markLiveAfterOwnTx\(agent\.term_id\)/)
    expect(vote).toMatch(/refreshPositionsAndSupply\(agent\.term_id, pendingVote\.counterTermId\)\n/)
    expect(vote).not.toMatch(/loadPage\(|fetchAgentsPage\(/)
    expect(src).toMatch(/if \(!seed\) setAgents\(\(prev\) => prev\.map\(\(row\) => \(row\.term_id === termId \? withLiveVault\(/)
    // The wallet's own position: its own live read; never derived from cached positions.
    expect(src).toMatch(/if \(!address \|\| allPositions\.length === 0 \|\| !positionsLive\) return/)
    expect(src).toMatch(/fetchUserPosition\(selectedAgent\.term_id, address, agentTriple\.counterTermId\)/)
    // The modal's age line, from the list's parts and its own.
    expect(src).toMatch(/modalFreshnessLabel\(pageView, modalData, liveAgent, nowTick\)/)
    expect(src).toMatch(/\{modalAge && <p data-testid="modal-age"/)
  })
})
