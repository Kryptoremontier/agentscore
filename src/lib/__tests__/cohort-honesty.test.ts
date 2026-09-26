import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchCohortAgents } from '../cohort-reader'
import { agentListHeaderSegments, type AgentScoreCorpusCounts, type CohortCorpusCounts } from '../agent-list'
import { readSharesWei } from '../score-basis'

/**
 * "Never fetched is not zero, failed is not empty." Evidence it was:
 * screenshots/2026-09-24/desktop/agents-list.png read "0 AgentScore · GraphQL
 * live feed" while BOTH fetches had failed — the cohort failure left no trace.
 */

afterEach(() => vi.unstubAllGlobals())

describe('fetchCohortAgents — a failed read is an error state, not an empty cohort', () => {
  it('transport failure → status "error", total unknown (null), not { agents: [], total: 0 }', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down') }))
    const r = await fetchCohortAgents()
    expect(r.status).toBe('error')
    expect(r.total).toBeNull()
    expect(r.truncated).toBeNull()
    expect(r.agents).toEqual([])
  })

  it('GraphQL error → status "error"', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => ({ errors: [{ message: 'field not found' }] }) })))
    expect((await fetchCohortAgents()).status).toBe('error')
  })

  it('a genuinely empty registry is status "ok" with total 0 — distinguishable from failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_u: unknown, init?: RequestInit) => {
      const q = String(JSON.parse(String(init?.body ?? '{}')).query)
      const data = q.includes('GetErc8004CohortCount') ? { triples_aggregate: { aggregate: { count: 0 } } } : { triples: [] }
      return { json: async () => ({ data }) }
    }))
    const r = await fetchCohortAgents()
    expect(r).toEqual({ agents: [], total: 0, truncated: false, status: 'ok' })
  })
})

describe('/agents header in each feed state', () => {
  const as = (status: AgentScoreCorpusCounts['status']): AgentScoreCorpusCounts =>
    ({ status, kept: status === 'ok' ? 9 : 0, junk: status === 'ok' ? 6 : 0, fetched: 15, total: 15, truncated: false })
  const co = (status: CohortCorpusCounts['status']): CohortCorpusCounts =>
    ({ status, count: status === 'ok' ? 264 : 0, total: status === 'ok' ? 264 : null, truncated: status === 'ok' ? false : null })
  const header = (a: AgentScoreCorpusCounts['status'], c: CohortCorpusCounts['status']) =>
    agentListHeaderSegments({ agentScore: as(a), cohort: co(c) }).join(' · ')

  it('both ok → counts and "GraphQL live feed"', () => {
    expect(header('ok', 'ok')).toBe('9 AgentScore · 264 ERC-8004 · 6 hidden · GraphQL live feed')
  })
  it('cohort failed → "ERC-8004 feed unavailable", no "live feed" claim', () => {
    expect(header('ok', 'error')).toBe('9 AgentScore · ERC-8004 feed unavailable · 6 hidden')
  })
  it('AgentScore failed → "AgentScore feed unavailable" (was "0 AgentScore"), no "live feed" claim', () => {
    expect(header('error', 'ok')).toBe('AgentScore feed unavailable · 264 ERC-8004')
  })
  it('both failed → both unavailable, no zeros, no "live feed"', () => {
    expect(header('error', 'error')).toBe('AgentScore feed unavailable · ERC-8004 feed unavailable')
  })
  it('loading → "—", never a 0 that was not measured', () => {
    expect(header('loading', 'loading')).toBe('— AgentScore · — ERC-8004')
  })
  it('an empty but successfully read cohort prints 0 — that zero IS a measurement', () => {
    expect(agentListHeaderSegments({ agentScore: as('ok'), cohort: { status: 'ok', count: 0, total: 0, truncated: false } }).join(' · '))
      .toBe('9 AgentScore · 0 ERC-8004 · 6 hidden · GraphQL live feed')
  })
})

describe('cohort cards: stake never fetched is not printed', () => {
  it('a cohort row (no positions_aggregate) has no vault reading — the card hides Stakes/Stakers', () => {
    expect(readSharesWei(undefined)).toBeNull()      // → stake line not rendered, list columns "—"
    expect(readSharesWei({ aggregate: { count: 0, sum: null } })).toBe(0n) // AgentScore row with a real 0 → printed
  })
})
