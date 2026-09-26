import { describe, it, expect, vi, afterEach } from 'vitest'
import { isErc8004Caip, foldClassificationBySubject, fetchCohortAgents, type ClassificationRow } from '../cohort-reader'
import { installFakeHasura } from './fake-hasura'

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
  function sameAsRow(i: number, subject = i) {
    return {
      term_id: `0xtriple${String(i).padStart(5, '0')}`,
      created_at: `2026-0${(i % 9) + 1}-01T00:00:00Z`,
      subject: { term_id: `0xagent${subject}`, label: `Agent 8453:${subject}` },
      object: { label: `eip155:8453/erc721:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432/${i}` },
    }
  }
  const distinctSubjects = (rows: Array<{ subject: { term_id: string } }>) => new Set(rows.map((r) => r.subject.term_id)).size

  // The endpoint as it behaves live: rows capped at 250 per request whatever `limit` says,
  // limit/offset honoured, the row count and the distinct-subject count on the same filter.
  function fakeCohort(rows: ReturnType<typeof sameAsRow>[], opts: { countsFail?: boolean; classification?: (q: string) => unknown[] } = {}) {
    return installFakeHasura({
      tables: [
        {
          match: (q) => q.includes('GetErc8004Cohort'),
          field: 'triples',
          rows,
          count: (q) => {
            if (opts.countsFail) throw new Error('count query down')
            return q.includes('distinct: true') ? distinctSubjects(rows) : rows.length
          },
        },
        { match: (q) => q.includes('GetCohortClassification'), field: 'triples', rows: (q) => opts.classification?.(q) ?? [] },
      ],
    })
  }

  afterEach(() => vi.unstubAllGlobals())

  it('264 same-as triples across two pages (250 + 14) → 263 subjects, total 263, not truncated', async () => {
    // Live shape 2026-09-26: 264 identity triples, one agent with two identity links.
    const rows = [...Array.from({ length: 263 }, (_, i) => sameAsRow(i)), sameAsRow(263, 7)]
    const fake = fakeCohort(rows)
    const result = await fetchCohortAgents()
    expect(fake.rowCalls('triples').filter((c) => c.query.includes('GetErc8004Cohort')).map((c) => c.variables.offset)).toEqual([0, 250])
    expect(result).toMatchObject({ status: 'ok', total: 263, truncated: false })
    expect(result.agents).toHaveLength(263)
  })

  it('a page failing mid-way (HTTP 429 on page 2) → status "error", never the first 250 presented as the cohort', async () => {
    const rows = Array.from({ length: 264 }, (_, i) => sameAsRow(i))
    installFakeHasura({
      tables: [{ match: (q) => q.includes('GetErc8004Cohort'), field: 'triples', rows }],
      fail: (q, v) => (q.includes('GetErc8004Cohort(') && v.offset === 250 ? 'rate-limit' : undefined),
    })
    vi.useFakeTimers()
    const pending = fetchCohortAgents()
    await vi.runAllTimersAsync()
    const result = await pending
    vi.useRealTimers()
    expect(result).toEqual({ agents: [], total: null, truncated: null, status: 'error' })
  })

  it('600 real rows, our cap 500 → truncated true, total 600, agents length 500', async () => {
    fakeCohort(Array.from({ length: 600 }, (_, i) => sameAsRow(i)))
    const result = await fetchCohortAgents()
    expect(result.truncated).toBe(true)
    expect(result.total).toBe(600)
    expect(result.agents).toHaveLength(500)
  })

  it('264 rows, well under the cap -> truncated false', async () => {
    fakeCohort(Array.from({ length: 264 }, (_, i) => sameAsRow(i)))
    const result = await fetchCohortAgents()
    expect(result.truncated).toBe(false)
    expect(result.total).toBe(264)
    expect(result.agents).toHaveLength(264)
  })

  it('exactly at the cap (500 of 500) -> not truncated', async () => {
    fakeCohort(Array.from({ length: 500 }, (_, i) => sameAsRow(i)))
    const result = await fetchCohortAgents()
    expect(result.truncated).toBe(false)
  })

  it('count-query failure on a complete read: the deduped rows ARE the total — never a false "empty cohort"', async () => {
    fakeCohort([sameAsRow(0), sameAsRow(1)], { countsFail: true })
    const result = await fetchCohortAgents()
    expect(result.total).toBe(2)
    expect(result.truncated).toBe(false)
    expect(result.agents).toHaveLength(2)
  })

  it('limit + 1: 501 distinct agents in the registry, our cap 500 → truncated true, total 501', async () => {
    fakeCohort(Array.from({ length: 501 }, (_, i) => sameAsRow(i)))
    const result = await fetchCohortAgents()
    expect(result.truncated).toBe(true)
    expect(result.total).toBe(501)
  })

  it('counts DISTINCT subjects on the SAME filter as the rows (units match: agents, not triples)', async () => {
    // 3 same-as triples, 2 subjects: agent0 has two identity links (seen live).
    const fake = fakeCohort([sameAsRow(0), { ...sameAsRow(2, 0), created_at: '2026-09-02T00:00:00Z' }, sameAsRow(1)])
    const result = await fetchCohortAgents()
    expect(result.agents).toHaveLength(2)
    expect(result.total).toBe(2) // was 3 (triples) before — a unit mismatch with agents.length
    const queries = fake.calls.map((c) => c.query)
    const count = queries.find((q) => q.includes('GetErc8004CohortCount'))!
    const rows = queries.find((q) => q.includes('GetErc8004Cohort('))!
    expect(count).toContain('count(columns: [subject_id], distinct: true)')
    for (const q of [count, rows]) {
      expect(q).toContain('%erc721:0x8004a169%')
      expect(q).toContain('subject_id: { _is_null: false }')
    }
  })

  it('at the cap with the counts unavailable -> total and truncated are unknown (null), never rows.length', async () => {
    fakeCohort(Array.from({ length: 700 }, (_, i) => sameAsRow(i)), { countsFail: true })
    const result = await fetchCohortAgents()
    expect(result.agents).toHaveLength(500)
    expect(result.total).toBeNull()
    expect(result.truncated).toBeNull()
  })

  it('chunks the classification lookup at 200 ids and merges results across chunks', async () => {
    const fake = fakeCohort(Array.from({ length: 450 }, (_, i) => sameAsRow(i)), {
      // Each chunk contributes one tag for its first subject, to prove all chunks' results merge.
      classification: (q) => {
        const first = q.match(/subject_id:\s*\{\s*_in:\s*\[\s*"([^"]+)"/)?.[1]
        return first ? [{ term_id: `0xedge-${first}`, subject_id: first, object: { term_id: '0xskill', label: 'defi' } }] : []
      },
    })
    const result = await fetchCohortAgents()
    // 450 ids at 200/chunk -> 3 chunks, x2 predicate groups (tags + categories) = 6 classification row reads.
    expect(fake.rowCalls('triples').filter((c) => c.query.includes('GetCohortClassification(')).length).toBe(6)
    expect(result.agents).toHaveLength(450)
    expect(result.agents.some(a => a.declaredSkills?.includes('defi'))).toBe(true)
  })

  it('a classification chunk with more than 250 edges is read to the end (live: 449 `has tag` edges in chunk 1)', async () => {
    const rows = Array.from({ length: 200 }, (_, i) => sameAsRow(i))
    fakeCohort(rows, {
      classification: () => rows.flatMap((r, i) => [
        { term_id: `0xa${String(i).padStart(5, '0')}`, subject_id: r.subject.term_id, object: { term_id: '0xs1', label: 'defi' } },
        { term_id: `0xb${String(i).padStart(5, '0')}`, subject_id: r.subject.term_id, object: { term_id: '0xs2', label: 'trading' } },
      ]),
    })
    const result = await fetchCohortAgents()
    // 400 edges per predicate group: a single capped request would have left the last agents without chips.
    expect(result.agents.every(a => a.declaredSkills?.join(',') === 'defi,trading')).toBe(true)
  })
})
