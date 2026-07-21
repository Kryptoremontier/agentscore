import { describe, it, expect, vi, afterEach } from 'vitest'
import { getDomainAgents } from '../api-data'

/**
 * Folded-atom resolution in by-id consumers: `TypeScript` exists on live
 * testnet as TWO atoms with one label. refineSkillTriples folds the smaller
 * onto the representative; getDomainAgents must resolve a link to the
 * folded-away term_id onto the merged leaderboard (merge, don't lose).
 */

const triple = (id: string, agentId: string, agentName: string, skillId: string) => ({
  term_id: id,
  counter_term_id: null,
  subject: { term_id: agentId, label: agentName },
  predicate: { label: 'is skilled in' },
  object: { term_id: skillId, label: 'TypeScript' },
})

// 0xbig has 2 triples → representative; 0xsmall (1 triple) folds onto it.
const TRIPLES = [
  triple('0xt1', '0xagent1', 'Agent One', '0xbig'),
  triple('0xt2', '0xagent2', 'Agent Two', '0xbig'),
  triple('0xt3', '0xagent3', 'Agent Three', '0xsmall'),
]

function stubGql() {
  vi.stubGlobal('fetch', vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}'))
    const data = String(body.query).includes('GetDomainPositions')
      ? { positions: [] }
      : { triples: TRIPLES }
    return { json: async () => ({ data }) }
  }))
}

afterEach(() => vi.unstubAllGlobals())

describe('getDomainAgents — folded duplicate-atom resolution', () => {
  it('resolves a folded-away term_id to the representative domain (merged leaderboard)', async () => {
    stubGql()
    const res = await getDomainAgents('0xsmall')
    expect(res.domain).toEqual({ id: '0xbig', name: 'TypeScript' })
    expect(res.agents).toHaveLength(3)
    expect(res.total).toBe(3)
  })

  it('returns the same merged leaderboard when queried by the representative id', async () => {
    stubGql()
    const res = await getDomainAgents('0xbig')
    expect(res.domain?.id).toBe('0xbig')
    expect(res.agents).toHaveLength(3)
  })

  it('still returns domain: null for a term_id that does not exist at all', async () => {
    stubGql()
    const res = await getDomainAgents('0xnonexistent')
    expect(res).toEqual({ domain: null, agents: [], total: 0 })
  })
})
