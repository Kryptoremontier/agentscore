import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

// getPlatformStats pulls the evaluator leaderboard through next/cache's
// unstable_cache, which needs a Next request context — not what this test is about.
vi.mock('../evaluator-data', () => ({
  fetchEvaluatorLeaderboard: vi.fn(async () => []),
  fetchStakerPositions: vi.fn(async () => []),
}))

import { getAgentsWithScores, getPlatformStats } from '../api-data'
import { qualityCacheClear } from '../scoring/quality-cache'
import {
  fetchAgentListCorpus, pluralize, matchesAgentSearch,
  agentListHeaderSegments, agentResultsLine, AGENT_LIST_LIMIT,
} from '../agent-list'
import { fetchFeaturedTotal, featuredBadgeText } from '../featured-counts'
import { installFakeHasura } from './fake-hasura'

/**
 * "One source per number" (REPO_MAP §7 rules 1 and 4). Live 2026-09-24 the
 * same deployment answered /api/v1/stats agents: 15 (no junk filter) and
 * /api/v1/agents meta.total: 9; the landing badge printed its own `limit: 8`.
 */

const row = (term_id: string, label: string, shares = '1000000000000000', count = 1) => ({
  term_id, label, data: null, type: 'Thing', emoji: null, created_at: '2026-03-01T00:00:00+00:00',
  creator: { label: 'x', id: '0x0' },
  positions_aggregate: { aggregate: { count, sum: { shares }, max: { created_at: '2026-03-01T00:00:00+00:00' } } },
  as_subject_triples: [],
})

// 3 real agents + 2 junk: a blocklisted fixture and a duplicate re-registration (folded).
const RAW_ROWS = [
  row('0x0d579846f21a66f35efafb2339d182e27560ec9f9d8ea64f7f1d9929d20a2d7d', 'Agent: OPEN CLAW from Kryptoremontier - test', '335061000000000000'),
  row('0x82d87d9517b68e653418c0e49805b36aca3e33a00536af25fc319f5c24802c5a', '{"name":"Luda","description":"AI watch for ludarep"}', '980000000000000'),
  row('0x60b8fa47d7165f07a475321a86a16f8e00e7d65c743647f6baa27f70f63df025', 'Agent:INTU: Code Helper AI - helper', '224900000000000000', 3),
  row('0xfd05aaaa00000000000000000000000000000000000000000000000000000001', 'Agent:INTU: Code Helper AI - helper', '0', 1), // duplicate → folded
  row('0x999e5bb71e149b98694dd49e9a0aaf172a10de428664d80244792d61234a00e4', 'Agent: SchemaTest-003', '0', 0), // blocklisted fixture
]

function stubGraphql(extra: (q: string) => unknown = () => undefined) {
  vi.stubGlobal('fetch', vi.fn(async (_url: unknown, init?: RequestInit) => {
    const q = String(JSON.parse(String(init?.body ?? '{}')).query)
    const data = extra(q)
      ?? (q.includes('ApiAgentsCount') ? { atoms_aggregate: { aggregate: { count: RAW_ROWS.length } } }
        : q.includes('ApiAgents') ? { atoms: RAW_ROWS }
        : q.includes('ApiSkillCount') ? { atoms_aggregate: { aggregate: { count: 0 } } }
        : q.includes('GetAllDomainTriples') ? { triples: [] }
        : q.includes('triples_aggregate') ? { triples_aggregate: { aggregate: { count: 0 } } }
        : { positions: [] })
    return { json: async () => ({ data }) }
  }))
}

beforeEach(() => qualityCacheClear())
afterEach(() => vi.unstubAllGlobals())

describe('stats and agents agree on the post-junk total', () => {
  it('/api/v1/stats `agents` === /api/v1/agents meta.total (both post-junk)', async () => {
    stubGraphql()
    const { total, junkFiltered } = await getAgentsWithScores({ limit: 100 })
    const stats = await getPlatformStats()
    expect(junkFiltered).toBe(2)
    expect(total).toBe(3)
    expect(stats.agents).toBe(total) // was RAW_ROWS.length (5) before — pre-junk
  })

  it('stats topAgent is never a junk row or an unmeasured prior', async () => {
    stubGraphql()
    const stats = await getPlatformStats()
    expect(stats.topAgent?.name).toMatch(/OPEN CLAW/)
  })
})

describe('landing badge: the corpus total, never the 8-row fetch length', () => {
  it('agents tab reads /api/v1/agents meta.total (9) even though only 8 rows are fetched', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: unknown) => {
      expect(String(url)).toContain('/api/v1/agents?limit=1')
      return { json: async () => ({ success: true, data: [{}], meta: { total: 9, truncated: false } }) }
    }))
    const t = await fetchFeaturedTotal('agents', { graphqlUrl: 'x', skillWhere: '{}', claimWhere: 'where: {}' })
    expect(t).toEqual({ total: 9, truncated: false })
    expect(featuredBadgeText(t)).toBe('9 indexed')
    expect(featuredBadgeText(t)).not.toBe('8 indexed')
  })

  it('skills tab reads an aggregate on the same where as its rows (corpus 23 > 8 rows)', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_u: unknown, init?: RequestInit) => {
      const q = String(JSON.parse(String(init?.body ?? '{}')).query)
      expect(q).toContain('atoms_aggregate(where: SKILL_WHERE)')
      return { json: async () => ({ data: { agg: { aggregate: { count: 23 } } } }) }
    }))
    const t = await fetchFeaturedTotal('skills', { graphqlUrl: 'x', skillWhere: 'SKILL_WHERE', claimWhere: '' })
    expect(featuredBadgeText(t)).toBe('23 indexed')
  })

  it('a failed total read prints no number at all', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    const t = await fetchFeaturedTotal('agents', { graphqlUrl: 'x', skillWhere: '{}', claimWhere: '' })
    expect(t).toBeNull()
    expect(featuredBadgeText(t)).toBeNull()
  })

  it('a truncated corpus reads as a lower bound', () => {
    expect(featuredBadgeText({ total: 500, truncated: true })).toBe('500+ indexed')
  })
})

describe('/agents header: corpus totals, stable under search', () => {
  const corpus = { status: 'ok' as const, kept: 9, junk: 6, fetched: 15, total: 15, truncated: false }
  const cohort = { status: 'ok' as const, count: 264, total: 264, truncated: false }

  it('header segments today: "9 AgentScore · 264 ERC-8004 · 6 hidden · GraphQL live feed"', () => {
    expect(agentListHeaderSegments({ agentScore: corpus, cohort }).join(' · '))
      .toBe('9 AgentScore · 264 ERC-8004 · 6 hidden · GraphQL live feed')
  })

  it('typing a search changes the results line, never the header', () => {
    const names = ['OPEN CLAW', 'Luda', 'Code Helper AI', 'Captain Dackie']
    const before = agentListHeaderSegments({ agentScore: corpus, cohort })
    const shown = names.filter(n => matchesAgentSearch('luda', [n]))
    const after = agentListHeaderSegments({ agentScore: corpus, cohort })
    expect(after).toEqual(before)
    expect(agentResultsLine(shown.length, names.length)).toEqual({ shown: 1, of: 4, noun: 'agents' })
  })

  it('one search rule for both corpora: displayed name or raw label, case-insensitive', () => {
    expect(matchesAgentSearch('LUDA', ['Luda', '{"name":"Luda"}'])).toBe(true)
    expect(matchesAgentSearch('ludarep', [null, '{"name":"Luda","description":"AI watch for ludarep"}'])).toBe(true)
    expect(matchesAgentSearch('', ['anything'])).toBe(true)
    expect(matchesAgentSearch('zzz', ['Luda', undefined])).toBe(false)
  })

  it('pluralizes: "1 agent", "273 agents"; "1 of 273 agents"', () => {
    expect(pluralize(1, 'agent')).toBe('1 agent')
    expect(pluralize(273, 'agent')).toBe('273 agents')
    expect(agentResultsLine(1, 1)).toEqual({ shown: 1, of: null, noun: 'agent' })
    expect(agentResultsLine(273, 273)).toEqual({ shown: 273, of: null, noun: 'agents' })
  })

  it('truncation segments appear only when truncated, in the fetch\'s own unit', () => {
    const segs = agentListHeaderSegments({
      agentScore: { status: 'ok', kept: 44, junk: 6, fetched: 50, total: 51, truncated: true },
      cohort: { status: 'ok', count: 500, total: 612, truncated: true },
    })
    expect(segs).toContain('showing first 50 of 51 AgentScore atoms')
    expect(segs).toContain('showing first 500 of 612 ERC-8004 agents')
  })
})

describe('truncation fires at limit + 1, never at the limit (paged — lib/gql-pager.ts)', () => {
  const atomsTable = (rows: unknown[], match: (q: string) => boolean) =>
    ({ match, field: 'atoms' as const, rows })

  it('/agents corpus fetch: 51 atoms, our cap 50 → 50 rows, total 51, truncated — count on the SAME where', async () => {
    const rows = Array.from({ length: AGENT_LIST_LIMIT + 1 }, (_, i) => row(`0x${String(i).padStart(64, '0')}`, `Agent: A${i}`))
    const fake = installFakeHasura({ tables: [atomsTable(rows, q => q.includes('AgentListCorpus'))], other: () => ({ positions: [] }) })
    const r = await fetchAgentListCorpus()
    expect(r.rows).toHaveLength(AGENT_LIST_LIMIT)
    expect(r.total).toBe(AGENT_LIST_LIMIT + 1)
    expect(r.truncated).toBe(true)
    const rowQ = fake.calls.find(c => c.query.includes('AgentListCorpus('))!.query
    const countQ = fake.calls.find(c => c.query.includes('AgentListCorpusCount'))!.query
    const where = (q: string) => q.match(/where: (\{[\s\S]*?\})\s*(limit|\))/)?.[1]?.replace(/\s+/g, ' ')
    expect(where(rowQ)).toBe(where(countQ))
  })

  it('/agents corpus fetch: exactly 50 atoms → not truncated', async () => {
    const rows = Array.from({ length: AGENT_LIST_LIMIT }, (_, i) => row(`0x${String(i).padStart(64, '0')}`, `Agent: A${i}`))
    installFakeHasura({ tables: [atomsTable(rows, q => q.includes('AgentListCorpus'))], other: () => ({ positions: [] }) })
    expect(await fetchAgentListCorpus()).toMatchObject({ total: AGENT_LIST_LIMIT, truncated: false })
  })

  it('/api/v1/agents: 501 atoms, corpus cap 500 → paged past the 250 server cap, truncated reported', async () => {
    const many = Array.from({ length: 501 }, (_, i) => row(`0x${String(i + 1).padStart(64, '0')}`, `Agent: Real ${i}`))
    const fake = installFakeHasura({
      tables: [atomsTable(many, q => q.includes('ApiAgents'))],
      other: (q) => q.includes('positions') ? { positions: [] } : undefined,
    })
    const r = await getAgentsWithScores({ limit: 1 })
    expect(r.truncated).toBe(true)
    expect(fake.rowCalls('atoms').map(c => c.variables.offset)).toEqual([0, 250])
  })

  it('/api/v1/agents: 300 atoms (above the 250 server cap, under our 500) → all read, not truncated', async () => {
    const many = Array.from({ length: 300 }, (_, i) => row(`0x${String(i + 1).padStart(64, '0')}`, `Agent: Real ${i}`))
    installFakeHasura({ tables: [atomsTable(many, q => q.includes('ApiAgents'))], other: (q) => q.includes('positions') ? { positions: [] } : undefined })
    const r = await getAgentsWithScores({ limit: 500 })
    expect(r.truncated).toBe(false)
    expect(r.total).toBe(300)
  })
})
