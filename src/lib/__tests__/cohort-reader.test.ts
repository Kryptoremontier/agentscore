import { describe, it, expect, vi, afterEach } from 'vitest'
import { isErc8004Caip, foldClassificationBySubject, fetchCohortAgents, type ClassificationRow } from '../cohort-reader'

describe('isErc8004Caip — CAIP pattern filter', () => {
  it('matches a real ERC-8004 CAIP identity label (Base)', () => {
    expect(isErc8004Caip('eip155:8453/erc721:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432/16850')).toBe(true)
  })

  it('matches case-insensitively (checksummed vs lowercase contract address)', () => {
    expect(isErc8004Caip('eip155:56/erc721:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432/2379')).toBe(true)
  })

  it('rejects an unrelated same-as target (e.g. an X/Twitter identity link)', () => {
    expect(isErc8004Caip('https://x.com/someagent')).toBe(false)
  })

  it('rejects a CAIP identity for a different contract', () => {
    expect(isErc8004Caip('eip155:8453/erc721:0x1234567890abcdef1234567890abcdef12345678/1')).toBe(false)
  })

  it('handles null/undefined/empty without throwing', () => {
    expect(isErc8004Caip(null)).toBe(false)
    expect(isErc8004Caip(undefined)).toBe(false)
    expect(isErc8004Caip('')).toBe(false)
  })
})

describe('foldClassificationBySubject — dual-resolution over cohort classification edges', () => {
  const row = (subject: string, id: string, label: string): ClassificationRow => ({
    subject_id: subject,
    object: { term_id: id, label },
  })

  it('groups labels per subject', () => {
    const result = foldClassificationBySubject([
      row('agent-1', '0xa', 'defi'),
      row('agent-1', '0xb', 'trading'),
      row('agent-2', '0xc', 'agriculture'),
    ])
    expect(result.get('agent-1')).toEqual(['defi', 'trading'])
    expect(result.get('agent-2')).toEqual(['agriculture'])
  })

  it('folds duplicate-atom-same-label edges onto one label per subject (no visual duplicate chip)', () => {
    // Same subject declares "technology/blockchain" via both duplicate atoms
    // observed live — must render as ONE chip, not two.
    const result = foldClassificationBySubject([
      row('agent-1', '0xa8437e51', 'technology/blockchain'),
      row('agent-1', '0x8e9153c1', 'technology/blockchain'),
    ])
    expect(result.get('agent-1')).toEqual(['technology/blockchain'])
  })

  it('dedups a subject that declares the SAME label twice via different duplicate atoms across two subjects consistently', () => {
    const result = foldClassificationBySubject([
      row('agent-1', '0xa', 'reputation'),
      row('agent-2', '0xb', 'reputation'), // duplicate atom of "reputation", different id
    ])
    // Both should fold to the same representative label string.
    expect(result.get('agent-1')).toEqual(['reputation'])
    expect(result.get('agent-2')).toEqual(['reputation'])
  })

  it('returns sorted labels for stable chip ordering', () => {
    const result = foldClassificationBySubject([
      row('agent-1', '0xa', 'trading'),
      row('agent-1', '0xb', 'agriculture'),
      row('agent-1', '0xc', 'blockchain'),
    ])
    expect(result.get('agent-1')).toEqual(['agriculture', 'blockchain', 'trading'])
  })

  it('skips rows with missing subject or object label', () => {
    const result = foldClassificationBySubject([
      { subject_id: '', object: { term_id: '0xa', label: 'defi' } },
      { subject_id: 'agent-1', object: { term_id: '0xb', label: '' } },
    ] as ClassificationRow[])
    expect(result.size).toBe(0)
  })

  it('returns an empty map for no edges', () => {
    expect(foldClassificationBySubject([]).size).toBe(0)
  })
})

describe('fetchCohortAgents — truncation is surfaced, never silently dropped (thesis §6)', () => {
  function sameAsRow(i: number) {
    return {
      created_at: `2026-0${(i % 9) + 1}-01T00:00:00Z`,
      subject: { term_id: `0xagent${i}`, label: `Agent 8453:${i}` },
      object: { label: `eip155:8453/erc721:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432/${i}` },
    }
  }

  // Simulates Hasura respecting the fetch cap: the main query returns at most
  // `returned` rows regardless of how large the real underlying cohort is —
  // `total` is what the separate aggregate query reports.
  function stubGql(returned: number, total: number) {
    const rows = Array.from({ length: returned }, (_, i) => sameAsRow(i))
    vi.stubGlobal('fetch', vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}'))
      const query = String(body.query)
      let data: unknown
      if (query.includes('GetErc8004CohortCount')) {
        data = { triples_aggregate: { aggregate: { count: total } } }
      } else if (query.includes('GetCohortClassification')) {
        data = { triples: [] }
      } else {
        data = { triples: rows }
      }
      return { json: async () => ({ data }) }
    }))
  }

  afterEach(() => vi.unstubAllGlobals())

  it('600 real rows, capped at 500 fetched -> truncated true, total 600, agents length 500', async () => {
    stubGql(500, 600)
    const result = await fetchCohortAgents()
    expect(result.truncated).toBe(true)
    expect(result.total).toBe(600)
    expect(result.agents).toHaveLength(500)
  })

  it('264 rows, well under the cap -> truncated false', async () => {
    stubGql(264, 264)
    const result = await fetchCohortAgents()
    expect(result.truncated).toBe(false)
    expect(result.total).toBe(264)
    expect(result.agents).toHaveLength(264)
  })

  it('exactly at the cap (500 of 500) -> not truncated', async () => {
    stubGql(500, 500)
    const result = await fetchCohortAgents()
    expect(result.truncated).toBe(false)
  })

  it('count-query failure degrades to the row count, not to 0 — never reports a false "empty cohort"', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}'))
      const query = String(body.query)
      if (query.includes('GetErc8004CohortCount')) throw new Error('count query down')
      if (query.includes('GetCohortClassification')) return { json: async () => ({ data: { triples: [] } }) }
      return { json: async () => ({ data: { triples: [sameAsRow(0), sameAsRow(1)] } }) }
    }))
    const result = await fetchCohortAgents()
    expect(result.total).toBe(2)
    expect(result.truncated).toBe(false)
    expect(result.agents).toHaveLength(2)
  })

  it('chunks the classification lookup at 200 ids and merges results across chunks', async () => {
    const rows = Array.from({ length: 450 }, (_, i) => sameAsRow(i))
    const classificationCalls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}'))
      const query = String(body.query)
      if (query.includes('GetErc8004CohortCount')) {
        return { json: async () => ({ data: { triples_aggregate: { aggregate: { count: 450 } } } }) }
      }
      if (query.includes('GetCohortClassification')) {
        classificationCalls.push(query)
        // Each chunk contributes one tag for its first subject, to prove all chunks' results merge.
        const match = query.match(/subject_id:\s*\{\s*_in:\s*\[\s*"([^"]+)"/)
        const firstIdInChunk = match?.[1]
        return {
          json: async () => ({
            data: { triples: firstIdInChunk ? [{ subject_id: firstIdInChunk, object: { term_id: '0xskill', label: 'defi' } }] : [] },
          }),
        }
      }
      return { json: async () => ({ data: { triples: rows } }) }
    }))

    const result = await fetchCohortAgents()
    // 450 ids at 200/chunk -> 3 chunks, x2 predicate groups (tags + categories) = 6 classification calls.
    expect(classificationCalls.length).toBe(6)
    expect(result.agents).toHaveLength(450)
    // The synthetic tag landed on subject 0 of some chunk in each predicate group — at least one
    // agent must have picked it up, proving chunked results were merged, not dropped.
    expect(result.agents.some(a => a.declaredSkills.includes('defi'))).toBe(true)
  })
})
