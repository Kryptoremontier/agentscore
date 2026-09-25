import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { getAgentsWithScores } from '../api-data'
import { qualityCacheClear } from '../scoring/quality-cache'

/**
 * /api/v1/agents (and MCP search_agents / trust_query, which read the same
 * rows) carry `scoreBasis` next to the unchanged `score` envelope:
 * 'prior' when the atom holds no stake, 'measured' otherwise.
 * Rows mirror live /api/v1/agents (2026-09-24); Luda and OPEN CLAW use their
 * real term ids (the junk filter guarantees both are kept).
 */

const LUDA = '0x82d87d9517b68e653418c0e49805b36aca3e33a00536af25fc319f5c24802c5a'
const OPEN_CLAW = '0x0d579846f21a66f35efafb2339d182e27560ec9f9d8ea64f7f1d9929d20a2d7d'
const AVATAR_CODER = '0x7c2a9629d24be2802e16dfff01d0392f0553ea9fd9c3c77014bbc1d1ea8b5ea0'

const row = (term_id: string, label: string, shares: string, count: number, created_at: string) => ({
  term_id, label, data: null, type: 'Thing', emoji: null, created_at,
  creator: { label: 'x', id: '0x0' },
  positions_aggregate: { aggregate: { count, sum: { shares }, max: { created_at } } },
  as_subject_triples: [],
})

const ROWS = [
  row(OPEN_CLAW, 'Agent: OPEN CLAW from Kryptoremontier - OPEN CLAW from Kryptoremontier for Testing AgentScore.', '335061000000000000', 1, '2026-02-18T15:47:00+00:00'),
  row(LUDA, '{"@context":"https://schema.org","@type":"Thing","name":"Luda","description":"AI watch for ludarep"}', '980000000000000', 1, '2026-06-01T07:58:48+00:00'),
  row(AVATAR_CODER, 'Agent: Agent Avatar Coder - Agent Avatar Coder from Kryptoremontier', '0', 1, '2026-02-23T20:51:17+00:00'),
]

beforeEach(() => {
  qualityCacheClear()
  vi.stubGlobal('fetch', vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}'))
    const q = String(body.query)
    const data = q.includes('ApiAgents') ? { atoms: ROWS } : { positions: [] }
    return { json: async () => ({ data }) }
  }))
})
afterEach(() => vi.unstubAllGlobals())

describe('getAgentsWithScores — scoreBasis', () => {
  it('every row carries scoreBasis; the score envelope itself is unchanged', async () => {
    const { agents } = await getAgentsWithScores({ limit: 50 })
    const byId = new Map(agents.map(a => [a.id, a]))

    const coder = byId.get(AVATAR_CODER)!
    expect(coder.scoreBasis).toBe('prior')
    // Contract kept for existing REST/MCP consumers: trustScore is still a number (the prior).
    expect(coder.score.trustScore).toBe(50)
    expect(coder.stakerCount).toBe(1) // one zero-share position — a "staker", not a measurement
  })

  it('Luda and OPEN CLAW are still present and still measured', async () => {
    const { agents } = await getAgentsWithScores({ limit: 50 })
    const byId = new Map(agents.map(a => [a.id, a]))
    expect(byId.get(LUDA)?.scoreBasis).toBe('measured')
    expect(byId.get(LUDA)?.score.trustScore).toBe(50) // measured, but 99% prior-weighted at 0.00098 tTRUST
    expect(byId.get(OPEN_CLAW)?.scoreBasis).toBe('measured')
    expect(byId.get(OPEN_CLAW)?.score.trustScore).toBe(98)
  })
})
