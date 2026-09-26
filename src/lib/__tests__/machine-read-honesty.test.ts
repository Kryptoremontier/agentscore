import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { installFakeHasura } from './fake-hasura'
import {
  publishedAgentScore, hasMeasuredScore, noScoreTooltip, supportPercent, OPPOSE_UNREAD_TOOLTIP, NO_STAKE_TOOLTIP,
} from '../score-basis'
import { rankComparison, comparedOverall, comparedBySkill } from '../agent-compare'
import { parseLandingStats, landingStatItems, fetchLandingStats } from '../landing-stats'

/**
 * Commit 6 — no invented numbers on machine-read surfaces. REST and MCP are
 * read by other agents: a default there travels further than on a page.
 */

// getPlatformStats pulls the evaluator leaderboard through next/cache's unstable_cache
// (needs a Next request context); getAgentTrustBreakdown would hit the RPC.
vi.mock('../evaluator-data', () => ({
  fetchEvaluatorLeaderboard: vi.fn(async () => []),
  fetchStakerPositions: vi.fn(async () => []),
}))
vi.mock('../on-chain-pricing', () => ({ getOnChainSharePrice: vi.fn(async () => null) }))

afterEach(() => { vi.unstubAllGlobals() })

// ─── Timeline: `?? 50` → null + scoreBasis ──────────────────────────────────

describe('publishedAgentScore — the one rule for a machine-read score', () => {
  it('not a scored AgentScore agent (no detail) → score null, scoreBasis null — never 50', () => {
    expect(publishedAgentScore(null)).toEqual({ score: null, scoreBasis: null })
  })
  it('zero stake (prior) → score null, scoreBasis "prior" — the 50 anchor is not published', () => {
    expect(publishedAgentScore({ agentScore: 50, scoreBasis: 'prior' })).toEqual({ score: null, scoreBasis: 'prior' })
  })
  it('measured → the AGENTSCORE, scoreBasis "measured"', () => {
    expect(publishedAgentScore({ agentScore: 73, scoreBasis: 'measured' })).toEqual({ score: 73, scoreBasis: 'measured' })
  })
})

const getAgentDetail = vi.fn()
const fetchTimelineData = vi.fn()
vi.mock('@/lib/api-data', async (orig) => ({ ...(await orig<object>()), getAgentDetail: (id: string) => getAgentDetail(id) }))
vi.mock('@/lib/timeline-data', () => ({ fetchTimelineData: (id: string) => fetchTimelineData(id) }))

const RAW = { agentId: '0xa', agentName: 'A', createdAt: '2026-01-01T00:00:00Z', counterTermId: null, stakingEvents: [], skillEvents: [] }
const detail = (agentScore: number, scoreBasis: 'measured' | 'prior') => ({
  id: '0xa', name: 'A', agentScore, scoreBasis, trustTier: 'unverified', tierBasis: 'attestations',
  score: { objectType: 'agent', trustScore: agentScore, qualityScore: null, objectScore: null, tier: 'moderate', softGateActive: false, computedAt: '' },
  skillBreakdown: [], momentumDirection: 'stable', stakerCount: 0,
})

describe('GET /api/v1/agents/:id/timeline', () => {
  beforeEach(() => { getAgentDetail.mockReset(); fetchTimelineData.mockReset() })
  const call = async () => {
    const { GET } = await import('@/app/api/v1/agents/[id]/timeline/route')
    const res = await GET(new NextRequest('http://localhost/api/v1/agents/0xa/timeline'), { params: Promise.resolve({ id: '0xa' }) })
    return { status: res.status, body: await res.json() }
  }

  it('an atom outside the scored corpus (e.g. an ERC-8004 agent) → currentScore null, scoreBasis null, no score point (was 50)', async () => {
    fetchTimelineData.mockResolvedValue(RAW)
    getAgentDetail.mockResolvedValue(null)
    const { status, body } = await call()
    expect(status).toBe(200)
    expect(body.data).toMatchObject({ currentScore: null, scoreBasis: null, currentTier: null, scoreHistory: [] })
  })

  it('zero stake → currentScore null, scoreBasis "prior" (the 50 anchor is not a score)', async () => {
    fetchTimelineData.mockResolvedValue(RAW)
    getAgentDetail.mockResolvedValue(detail(50, 'prior'))
    const { body } = await call()
    expect(body.data).toMatchObject({ currentScore: null, scoreBasis: 'prior', scoreHistory: [] })
  })

  it('measured → the score and scoreBasis "measured", one real point', async () => {
    fetchTimelineData.mockResolvedValue(RAW)
    getAgentDetail.mockResolvedValue(detail(73, 'measured'))
    const { body } = await call()
    expect(body.data).toMatchObject({ currentScore: 73, scoreBasis: 'measured' })
    expect(body.data.scoreHistory.map((p: { score: number }) => p.score)).toEqual([73])
  })

  it('a failed read is an error (5xx), never "Agent not found"', async () => {
    fetchTimelineData.mockRejectedValue(new Error('GraphQL HTTP 429'))
    getAgentDetail.mockResolvedValue(null)
    const { status, body } = await call()
    expect(status).toBe(500)
    expect(body.error).not.toMatch(/not found/i)
  })
})

describe('fetchTimelineData — null means "no such atom", a failed read throws', () => {
  it('HTTP 429 on the atom read → rejects (was null → a 404 "Agent not found")', async () => {
    const actual = await vi.importActual<typeof import('../timeline-data')>('../timeline-data')
    installFakeHasura({ tables: [], fail: () => 'rate-limit' })
    await expect(actual.fetchTimelineData('0xa')).rejects.toThrow()
  })
  it('no such atom → null', async () => {
    const actual = await vi.importActual<typeof import('../timeline-data')>('../timeline-data')
    installFakeHasura({ tables: [], other: (q) => (q.includes('GetAgentAtom') ? { atom: [] } : undefined) })
    await expect(actual.fetchTimelineData('0xa')).resolves.toBeNull()
  })
})

// ─── MCP: get_agent_timeline and compare_agents, through the real handler ──

async function mcpCall(name: string, args: Record<string, unknown>) {
  const { POST } = await import('@/app/api/mcp/[transport]/route')
  const res = await POST(new Request('http://localhost/api/mcp/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  }))
  const raw = await res.text()
  const json = JSON.parse(raw.includes('data:') ? raw.split('\n').find((l) => l.startsWith('data:'))!.slice(5) : raw)
  return JSON.parse(json.result.content[0].text)
}

describe('MCP get_agent_timeline', () => {
  beforeEach(() => { getAgentDetail.mockReset(); fetchTimelineData.mockReset() })
  it('zero stake → currentScore null + scoreBasis "prior" (was 50 with nothing saying it is a prior)', async () => {
    fetchTimelineData.mockResolvedValue(RAW)
    getAgentDetail.mockResolvedValue(detail(50, 'prior'))
    expect(await mcpCall('get_agent_timeline', { agentId: '0xa' })).toMatchObject({ currentScore: null, scoreBasis: 'prior' })
  })
  it('not a scored agent → currentScore null + scoreBasis null', async () => {
    fetchTimelineData.mockResolvedValue(RAW)
    getAgentDetail.mockResolvedValue(null)
    expect(await mcpCall('get_agent_timeline', { agentId: '0xa' })).toMatchObject({ currentScore: null, scoreBasis: null })
  })
})

// ─── compare_agents: unmeasured agents rank last ────────────────────────────

describe('rankComparison — a prior never outranks a measurement', () => {
  const rows = [
    { name: 'Prior', agentScore: 50, scoreBasis: 'prior' as const },
    { name: 'Low', agentScore: 31, scoreBasis: 'measured' as const },
    { name: 'High', agentScore: 88, scoreBasis: 'measured' as const },
  ]
  it('measured by score, then the prior; the recommendation is measured', () => {
    const { ranked, recommendation } = rankComparison(rows, comparedOverall)
    expect(ranked.map((r) => [r.name, r.rank])).toEqual([['High', 1], ['Low', 2], ['Prior', 3]])
    expect(recommendation?.name).toBe('High')
  })
  it('a measured 31 ranks above a 50 prior (was: the prior ranked first)', () => {
    const { ranked } = rankComparison([rows[0], rows[1]], comparedOverall)
    expect(ranked.map((r) => r.name)).toEqual(['Low', 'Prior'])
  })
  it('every agent unmeasured → no recommendation (was: the first id won)', () => {
    const { recommendation } = rankComparison([rows[0], { ...rows[0], name: 'Prior 2' }], comparedOverall)
    expect(recommendation).toBeNull()
  })
  it('by skill: missing skill → null (was 0), zero-stake skill triple → prior; both after a measured skill score', () => {
    const skills = {
      measured: [{ skillName: 'Crypto / Onchain', score: 22, supportStake: 0.01, opposeStake: 0.03 }],
      prior: [{ skillName: 'Crypto / Onchain', score: 50, supportStake: 0, opposeStake: 0 }],
      missing: [{ skillName: 'Social', score: 90, supportStake: 1, opposeStake: 0 }],
    }
    expect(comparedBySkill(skills.missing, 'crypto')).toEqual({ score: null, basis: 'missing', skillName: null })
    expect(comparedBySkill(skills.prior, 'crypto')).toEqual({ score: null, basis: 'prior', skillName: 'Crypto / Onchain' })
    const agents = [
      { name: 'Missing', skills: skills.missing }, { name: 'Prior', skills: skills.prior }, { name: 'Measured', skills: skills.measured },
    ]
    const { ranked, recommendation } = rankComparison(agents, (a) => comparedBySkill(a.skills, 'crypto'))
    expect(ranked.map((r) => r.name)).toEqual(['Measured', 'Prior', 'Missing'])
    expect(recommendation?.name).toBe('Measured')
  })
})

describe('MCP compare_agents', () => {
  beforeEach(() => getAgentDetail.mockReset())
  it('ranks the unmeasured agent last with scoreBasis "prior" and recommends the measured one', async () => {
    getAgentDetail.mockImplementation(async (id: string) =>
      id === '0xprior' ? { ...detail(50, 'prior'), id, name: 'Prior' } : { ...detail(31, 'measured'), id, name: 'Measured Low' })
    const out = await mcpCall('compare_agents', { agentIds: ['0xprior', '0xlow'] })
    expect(out.comparison.map((c: { name: string; rank: number; scoreBasis: string; comparedScore: number | null }) =>
      [c.name, c.rank, c.scoreBasis, c.comparedScore])).toEqual([
      ['Measured Low', 1, 'measured', 31],
      ['Prior', 2, 'prior', null],
    ])
    expect(out.recommendation).toBe('Measured Low')
  })
  it('no measured agent → recommendation null, with a note', async () => {
    getAgentDetail.mockImplementation(async (id: string) => ({ ...detail(50, 'prior'), id, name: id }))
    const out = await mcpCall('compare_agents', { agentIds: ['0xa', '0xb'] })
    expect(out.recommendation).toBeNull()
    expect(out.recommendationNote).toMatch(/measured/)
  })
})

// ─── Failed oppose read → unknown, not 0 ────────────────────────────────────

describe('score-basis: an unread oppose side is unknown, never 0', () => {
  it('support read, oppose read failed (null) → not measured, "—" with the oppose-unread reason', () => {
    const reading = { supportWei: 5n * 10n ** 17n, opposeWei: null }
    expect(hasMeasuredScore(reading)).toBe(false)
    expect(supportPercent(reading)).toBeNull()
    expect(noScoreTooltip(reading)).toBe(OPPOSE_UNREAD_TOOLTIP)
  })
  it('no counter-vault (undefined) is a real 0 oppose → measured on support alone', () => {
    expect(hasMeasuredScore({ supportWei: 1n })).toBe(true)
    expect(noScoreTooltip({ supportWei: 0n })).toBe(NO_STAKE_TOOLTIP)
  })
})

describe('agents list: a failed positions read leaves oppose unknown', () => {
  const COUNTER = '0xcounter'
  const atomRow = (term_id: string, counter: string | null) => ({
    term_id, label: `Agent: ${term_id}`, data: null, type: 'Thing', created_at: '2026-03-01T00:00:00+00:00',
    positions_aggregate: { aggregate: { sum: { shares: '1000000000000000' } } },
    as_subject_triples: counter ? [{ counter_term_id: counter }] : [],
  })
  it('fetchAgentListCorpus: row with a counter-vault → __opposeWei null (unknown), stakers null; no counter-vault → untouched', async () => {
    installFakeHasura({
      tables: [{ match: (q) => q.includes('AgentListCorpus'), field: 'atoms', rows: [atomRow('0xa', COUNTER), atomRow('0xb', null)] }],
      fail: (q) => (q.includes('VaultPositions') ? 'rate-limit' : undefined),
    })
    const { fetchAgentListCorpus } = await import('../agent-list')
    const { rows } = await fetchAgentListCorpus()
    const [a, b] = rows
    expect(a.__opposeWei).toBeNull()
    expect(a.liveStakerCount).toBeNull()
    expect(hasMeasuredScore({ supportWei: 10n ** 15n, opposeWei: a.__opposeWei === null ? null : (a.__opposeWei ?? 0n) })).toBe(false)
    expect(b.__opposeWei).toBeUndefined()
  })
  it('REST/MCP (getAgentsWithScores): a failed positions read rejects — never a list scored on 0 oppose', async () => {
    const actual = await vi.importActual<typeof import('../api-data')>('../api-data')
    installFakeHasura({
      tables: [{ match: (q) => q.includes('ApiAgent'), field: 'atoms', rows: [{ ...atomRow('0xa', COUNTER), emoji: null, creator: { label: 'x', id: '0x0' } }] }],
      other: (q) => (q.includes('signals') ? { signals: [] } : undefined),
      fail: (q) => (q.includes('VaultPositions') ? 'throw' : undefined),
    })
    await expect(actual.getAgentsWithScores({ limit: 10 })).rejects.toThrow()
  })
})

// ─── Landing: one source, "Attesters", unknown never 0 ─────────────────────

describe('landing stats (Hero / Stats / CTA) — /api/v1/stats only', () => {
  const ok = { success: true, data: { agents: 9, agentsTruncated: false, attesters: 1, totalStaked: 0.8274, activeStakers: 5, claims: null } }

  it('parses the stats body; attesters null stays null', () => {
    expect(parseLandingStats(ok)).toEqual({ agents: 9, agentsTruncated: false, attesters: 1, totalStaked: 0.8274, activeStakers: 5 })
    expect(parseLandingStats({ ...ok, data: { ...ok.data, attesters: null } })?.attesters).toBeNull()
  })
  it('a failed or incomplete answer → null (the tiles print "—"), never zeros', () => {
    expect(parseLandingStats({ success: false, error: 'Internal server error' })).toBeNull()
    expect(parseLandingStats({ success: true, data: { agents: 9 } })).toBeNull()
    for (const state of [{ status: 'loading' } as const, { status: 'error' } as const]) {
      expect(landingStatItems(state).map((i) => i.value)).toEqual([null, null, null, null])
    }
  })
  it('the tiles: Registered Agents, Attesters (not "Attestations"), Total Staked, Active Stakers', () => {
    const items = landingStatItems({ status: 'ok', stats: parseLandingStats(ok)! })
    expect(items.map((i) => [i.label, i.value])).toEqual([
      ['Registered Agents', 9], ['Attesters', 1], ['Total Staked', 0.8274], ['Active Stakers', 5],
    ])
  })
  it('Hero, Stats and CTA mounting together share one request; a 500 → null', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({ success: false }) }))
    vi.stubGlobal('fetch', fetchMock)
    const results = await Promise.all([fetchLandingStats(), fetchLandingStats(), fetchLandingStats()])
    expect(results).toEqual([null, null, null])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/stats')
  })
})

describe('getPlatformStats — attesters, and no 0 for a failed count', () => {
  const W = '0x139219107C1eBE569f543C581b3B807Cf6740006'
  const CRYPTO = '0xecc2b1dce5f8269777d9001faa532642691d7038eed3c639f04895ac5b312d42'
  const KNOWLEDGE = '0x8a0e3710014141458ee303a6cc504704ee3da370450d7f5cd5a898186a2f66e4'
  const TRIPLES = [
    { term_id: '0xt1', counter_term_id: null, subject: { term_id: '0xdackie', label: 'Captain Dackie' }, object: { term_id: CRYPTO } },
    { term_id: '0xt2', counter_term_id: null, subject: { term_id: '0xluda', label: 'Luda' }, object: { term_id: KNOWLEDGE } },
  ]
  // Live 2026-09-26: one wallet attests both Dackie and Luda; a second sold out (0 shares).
  const POSITIONS = [
    { id: '0xt1-1-w', term_id: '0xt1', account_id: W, shares: '9900000000000000' },
    { id: '0xt2-1-w', term_id: '0xt2', account_id: W.toLowerCase(), shares: '20790000000000000' },
    { id: '0xt2-1-x', term_id: '0xt2', account_id: '0x5555555555555555555555555555555555555555', shares: '0' },
  ]
  const fake = (opts: { attestationsFail?: boolean; claimsFail?: boolean } = {}) => installFakeHasura({
    tables: [
      { match: (q) => q.includes('ApiAgent'), field: 'atoms', rows: [] },
      { match: (q) => q.includes('ApiSkillCount'), field: 'atoms', rows: [], count: 12 },
      { match: (q) => q.includes('GetAttestationTriple'), field: 'triples', rows: TRIPLES },
      { match: (q) => q.includes('VaultPositions'), field: 'positions', rows: (_q, v) => POSITIONS.filter((p) => (v.vaultIds as string[]).includes(p.term_id)) },
      { match: (q) => q.includes('GetAllDomainTriples'), field: 'triples', rows: [] },
      { match: (q) => !q.includes('query') && q.includes('triples_aggregate'), field: 'triples', rows: [], count: 417 },
    ],
    fail: (q) => (opts.attestationsFail && q.includes('GetAttestationTriple')) || (opts.claimsFail && !q.includes('query') && q.includes('triples_aggregate'))
      ? 'throw' : undefined,
  })
  const stats = async () => (await vi.importActual<typeof import('../api-data')>('../api-data')).getPlatformStats()

  it('attesters = distinct live wallets across all attestations (1 live: one wallet on Dackie and Luda)', async () => {
    fake()
    expect(await stats()).toMatchObject({ attesters: 1, claims: 417, skills: 12 })
  })
  it('attestation read fails → attesters null; claims read fails → claims null (was 0)', async () => {
    fake({ attestationsFail: true, claimsFail: true })
    expect(await stats()).toMatchObject({ attesters: null, claims: null })
  })
})

// ─── Classification: a failed read is an error state ───────────────────────

describe('fetchCohortAgents — a failed classification chunk is unknown, not "declares nothing"', () => {
  const sameAs = (i: number) => ({
    term_id: `0xtriple${String(i).padStart(5, '0')}`,
    created_at: '2026-07-01T00:00:00Z',
    subject: { term_id: `0xagent${i}`, label: `Agent ${String(i).padStart(3, '0')}` },
    object: { label: `eip155:8453/erc721:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432/${i}` },
  })
  it('chunk 2 of the `has category` read fails → those 50 agents get declaredDomains null; the rest keep theirs', async () => {
    const rows = Array.from({ length: 250 }, (_, i) => sameAs(i))
    installFakeHasura({
      tables: [
        { match: (q) => q.includes('GetErc8004Cohort'), field: 'triples', rows, count: (q) => rows.length + (q.includes('distinct') ? 0 : 0) },
        {
          match: (q) => q.includes('GetCohortClassification'),
          field: 'triples',
          rows: (q) => rows.filter((r) => q.includes(`"${r.subject.term_id}"`)).map((r) => ({ term_id: `0xe${r.term_id}`, subject_id: r.subject.term_id, object: { term_id: '0xd', label: 'finance' } })),
        },
      ],
      // The second 200-id chunk of the category predicates (0xddde… / 0x96c2…) fails.
      fail: (q) => (q.includes('GetCohortClassification') && q.includes('0xddde1d94') && q.includes('"0xagent249"') ? 'throw' : undefined),
    })
    const { fetchCohortAgents } = await import('../cohort-reader')
    const result = await fetchCohortAgents()
    expect(result.status).toBe('ok')
    const unread = result.agents.filter((a) => a.declaredDomains === null)
    expect(unread).toHaveLength(50)
    expect(result.agents.filter((a) => a.declaredDomains?.includes('finance'))).toHaveLength(200)
    // The tag read (the other predicate group) succeeded for everyone.
    expect(result.agents.every((a) => a.declaredSkills !== null)).toBe(true)
  })
})

// ─── Review follow-ups ──────────────────────────────────────────────────────

describe('noScoreTooltip — a stake never read is not "no stake"', () => {
  it('support never read (cohort row) → "not read on this list", not "No stake yet"', async () => {
    const { STAKE_UNREAD_TOOLTIP } = await import('../score-basis')
    expect(noScoreTooltip({ supportWei: null })).toBe(STAKE_UNREAD_TOOLTIP)
    expect(noScoreTooltip({ supportWei: undefined, opposeWei: null })).toBe(STAKE_UNREAD_TOOLTIP)
  })
})

describe('comparedBySkill — a staked match beats an unstaked one', () => {
  it("'Code Review' (zero stake, 50 prior) must not hide 'Coding' (staked, 40) for skill 'cod'", () => {
    const skills = [
      { skillName: 'Code Review', score: 50, supportStake: 0, opposeStake: 0 },
      { skillName: 'Coding', score: 40, supportStake: 0.02, opposeStake: 0 },
    ]
    expect(comparedBySkill(skills, 'cod')).toEqual({ score: 40, basis: 'measured', skillName: 'Coding' })
  })
})

describe('landing: unknown truncation is a lower bound; a failed attesters read says so', () => {
  const base = { agents: 500, attesters: null, totalStaked: 1, activeStakers: 2 }
  it('agentsTruncated false → exact; true or null (unknown) → "500+"', async () => {
    const { agentCountSuffix } = await import('../landing-stats')
    expect(agentCountSuffix({ agentsTruncated: false })).toBe('')
    expect(agentCountSuffix({ agentsTruncated: true })).toBe('+')
    expect(agentCountSuffix({ agentsTruncated: null })).toBe('+')
    const [agents, attesters] = landingStatItems({ status: 'ok', stats: { ...base, agentsTruncated: null } })
    expect(agents.suffix).toBe('+')
    expect(attesters).toMatchObject({ value: null, unavailable: expect.stringMatching(/couldn.t read/i) })
  })
  it('loading carries no failure reason; a failed read does', () => {
    expect(landingStatItems({ status: 'loading' }).map((i) => i.unavailable)).toEqual([null, null, null, null])
    expect(landingStatItems({ status: 'error' }).every((i) => i.unavailable)).toBe(true)
  })
})

describe('getPlatformStats — one failed side read never blanks the corpus numbers', () => {
  it('skills, domains and evaluators failing → those fields null; agents / stake / stakers still answered', async () => {
    const evaluators = await import('../evaluator-data')
    vi.mocked(evaluators.fetchEvaluatorLeaderboard).mockRejectedValueOnce(new Error('evaluators down'))
    installFakeHasura({
      tables: [
        { match: (q) => q.includes('ApiAgent'), field: 'atoms', rows: [] },
        { match: (q) => q.includes('GetAttestationTriple'), field: 'triples', rows: [] },
      ],
      other: (q) => (!q.includes('query') && q.includes('triples_aggregate') ? { triples_aggregate: { aggregate: { count: 3 } } } : undefined),
      fail: (q) => (q.includes('ApiSkillCount') || q.includes('GetAllDomainTriples') ? 'throw' : undefined),
    })
    const stats = await (await vi.importActual<typeof import('../api-data')>('../api-data')).getPlatformStats()
    expect(stats).toMatchObject({ agents: 0, activeStakers: 0, skills: null, domains: null, evaluators: null, topDomain: null, claims: 3, attesters: 0 })
  })
})

describe('getAgentDetail — zero-stake skill triples never feed a "measured" AGENTSCORE', () => {
  const AGENT = '0xa9e0000000000000000000000000000000000000000000000000000000000001'
  const SKILL_TRIPLE = '0xskill'
  const agentRow = {
    term_id: AGENT, label: 'Agent: Staked One', data: null, type: 'Thing', emoji: null, created_at: '2026-01-01T00:00:00+00:00',
    creator: { label: 'x', id: '0x0' },
    positions_aggregate: { aggregate: { sum: { shares: '500000000000000000' }, max: { created_at: '2026-01-01T00:00:00+00:00' } } },
    as_subject_triples: [],
  }
  const fake = (skillShares: string) => installFakeHasura({
    tables: [
      { match: (q) => q.includes('ApiAgent'), field: 'atoms', rows: [agentRow] },
      {
        match: (q) => q.includes('GetAgentAllTriples'), field: 'triples',
        rows: [{ term_id: SKILL_TRIPLE, counter_term_id: null, predicate: { term_id: '0xp', label: 'hasAgentSkill' }, object: { term_id: '0xo', label: 'Coding' } }],
      },
      {
        match: (q) => q.includes('VaultPositions'), field: 'positions',
        rows: (_q, v) => [
          { id: `${AGENT}-1-w`, term_id: AGENT, account_id: '0x0000000000000000000000000000000000000001', shares: '500000000000000000' },
          { id: `${SKILL_TRIPLE}-1-w`, term_id: SKILL_TRIPLE, account_id: '0x0000000000000000000000000000000000000001', shares: skillShares },
        ].filter((p) => (v.vaultIds as string[]).includes(p.term_id)),
      },
      { match: (q) => q.includes('GetAttestationTriple'), field: 'triples', rows: [] },
    ],
    other: (q) => (q.includes('signals') ? { signals: [] } : undefined),
  })
  const detailOf = async () => (await vi.importActual<typeof import('../api-data')>('../api-data')).getAgentDetail(AGENT)

  it('the only skill triple was fully redeemed (0 shares) → qualityScore null, agentScore = trustScore', async () => {
    fake('0')
    const d = await detailOf()
    expect(d?.scoreBasis).toBe('measured')
    expect(d?.score.qualityScore).toBeNull()
    expect(d?.agentScore).toBe(d?.score.trustScore)
  })
  it('a staked skill triple still feeds the quality score (control)', async () => {
    fake('20000000000000000')
    const d = await detailOf()
    expect(d?.score.qualityScore).not.toBeNull()
  })
})
