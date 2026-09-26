import { describe, it, expect, vi, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { installFakeHasura } from './fake-hasura'

/**
 * The endpoint rate-limits with a bare HTTP 429 `{"message":"API rate limit exceeded"}` —
 * no `errors`, no `data`. Seen live 2026-09-26 while snapshotting REST/MCP: api-data's
 * gql returned `undefined`, `data?.atoms || []` made it an empty corpus, and
 * /api/v1/agents/:id answered 404 "Agent not found" for Luda and every agent after her.
 * A failed read must surface as a failure (REPO_MAP §7 rule 5), never as "not found".
 */

vi.mock('../evaluator-data', () => ({
  fetchEvaluatorLeaderboard: vi.fn(async () => []),
  fetchStakerPositions: vi.fn(async () => []),
}))

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

const LUDA = '0x82d87d9517b68e653418c0e49805b36aca3e33a00536af25fc319f5c24802c5a'

describe('HTTP 429 is a failure, not an empty result', () => {
  it('getAgentDetail rejects under a persistent 429 — it does not resolve null ("not found")', async () => {
    installFakeHasura({ tables: [], fail: () => 'rate-limit' })
    vi.useFakeTimers()
    const { getAgentDetail } = await import('../api-data')
    const p = getAgentDetail(LUDA)
    const assertion = expect(p).rejects.toThrow('GraphQL HTTP 429')
    await vi.runAllTimersAsync()
    await assertion
  })

  it('GET /api/v1/agents/:id answers 500, not 404, when the indexer rate-limits', async () => {
    installFakeHasura({ tables: [], fail: () => 'rate-limit' })
    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { GET } = await import('@/app/api/v1/agents/[id]/route')
    const p = GET(new NextRequest(`http://localhost/api/v1/agents/${LUDA}`), { params: Promise.resolve({ id: LUDA }) })
    await vi.runAllTimersAsync()
    const res = await p
    expect(res.status).toBe(500)
  })
})
