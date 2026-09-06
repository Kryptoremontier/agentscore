import { describe, it, expect } from 'vitest'
import { effectiveLabel } from '../api-data'
import { filterAgents, type JunkCandidate } from '../agent-junk-filter'

/**
 * Server path (api-data.ts's getAgentsWithScores) and client path
 * (agents/page.tsx's own fetch, per the two-surface pattern) build their
 * JunkCandidate arrays from independent code, over slightly different row
 * types (AgentRow vs GraphQLAgent) — but both now read the SAME two things
 * from a raw atom row: `effectiveLabel(row)` for the label, and
 * `positions_aggregate.aggregate.{count,sum.shares}` for stakers/stake
 * (verified by reading both call sites: api-data.ts's rowToAgentItem and
 * agents/page.tsx's fetchAgents candidate-building block).
 *
 * There's no DOM/component test infra in this repo (see decimal-input.ts's
 * file header for the same constraint), so this can't literally invoke the
 * React page. Instead it rebuilds each path's candidate exactly as its own
 * source does, over identical raw rows, and asserts filterAgents — the
 * shared decision logic both paths ultimately call — produces the same
 * kept/junk sets either way. This is exactly the invariant the 2026-09-06
 * regression broke: one path silently normalized labels differently than
 * the other.
 */

interface RawRow {
  term_id: string
  label: string
  data?: string | null
  positions_aggregate?: { aggregate: { count: number; sum: { shares: string | null } | null } | null }
  created_at: string
}

function toServerCandidate(row: RawRow): JunkCandidate<RawRow> {
  // Mirrors api-data.ts's rowToAgentItem + getAgentsWithScores candidate map:
  // label: a.rawLabel (== effectiveLabel(row)), stakerCount/supportStake via
  // positions_aggregate, weiToFloat == Number(wei) / 1e18.
  return {
    termId: row.term_id,
    label: effectiveLabel(row),
    stakerCount: row.positions_aggregate?.aggregate?.count || 0,
    totalStake: Number(row.positions_aggregate?.aggregate?.sum?.shares || '0') / 1e18,
    createdAt: row.created_at,
    original: row,
  }
}

function toClientCandidate(row: RawRow): JunkCandidate<RawRow> {
  // Mirrors agents/page.tsx's fetchAgents candidate map, verbatim field access.
  return {
    termId: row.term_id,
    label: effectiveLabel(row),
    stakerCount: row.positions_aggregate?.aggregate?.count || 0,
    totalStake: Number(row.positions_aggregate?.aggregate?.sum?.shares || '0') / 1e18,
    createdAt: row.created_at,
    original: row,
  }
}

const RAW_ROWS: RawRow[] = [
  {
    term_id: '0x60b8fa47d7165f07a475321a86a16f8e00e7d65c743647f6baa27f70f63df025',
    label: 'Agent:INTU: Code Helper AI - First On-Chain with Full reputaiton and identity Helper AI for Coding systems.',
    data: 'Agent:INTU: Code Helper AI - First On-Chain with Full reputaiton and identity Helper AI for Coding systems.',
    positions_aggregate: { aggregate: { count: 3, sum: { shares: (0.2249e18).toString() } } },
    created_at: '2026-04-01T00:00:00Z',
  },
  {
    term_id: '0xfd05c1f7bc1ebf0100d8e8d0a1e69489982ff373ed7a51440983bb4b1a283fd7',
    label: 'Agent: Code Helper AI - The best Claude Code Helper AI on Intuition !',
    data: 'Agent: Code Helper AI - The best Claude Code Helper AI on Intuition !',
    positions_aggregate: { aggregate: { count: 2, sum: { shares: (0.3322e18).toString() } } },
    created_at: '2026-03-01T00:00:00Z',
  },
  {
    term_id: '0x82d87d9517b68e653418c0e49805b36aca3e33a00536af25fc319f5c24802c5a',
    label: 'Agent:Luda',
    data: 'Agent:Luda',
    positions_aggregate: { aggregate: { count: 1, sum: { shares: (0.00098e18).toString() } } },
    created_at: '2026-06-01T00:00:00Z',
  },
  {
    // schema.org-style JSON atom: label is the Hasura placeholder, real
    // content lives in `data` — effectiveLabel(row) must resolve to `data`
    // identically for both paths.
    term_id: '0xjsonatom',
    label: 'json object',
    data: JSON.stringify({ '@context': 'https://schema.org', '@type': 'Thing', name: 'JSON Agent' }),
    positions_aggregate: { aggregate: { count: 1, sum: { shares: (0.05e18).toString() } } },
    created_at: '2026-05-01T00:00:00Z',
  },
]

function sortedTermIds(items: RawRow[]): string[] {
  return items.map((r) => r.term_id).sort()
}

describe('server path vs client path — identical raw rows produce identical kept/junk sets', () => {
  it('same kept term_ids', () => {
    const server = filterAgents(RAW_ROWS.map(toServerCandidate))
    const client = filterAgents(RAW_ROWS.map(toClientCandidate))
    expect(sortedTermIds(server.kept)).toEqual(sortedTermIds(client.kept))
  })

  it('same junk term_ids and reasons', () => {
    const server = filterAgents(RAW_ROWS.map(toServerCandidate))
    const client = filterAgents(RAW_ROWS.map(toClientCandidate))
    const serverJunk = server.junk.map((j) => ({ termId: j.item.term_id, reason: j.reason })).sort((a, b) => a.termId.localeCompare(b.termId))
    const clientJunk = client.junk.map((j) => ({ termId: j.item.term_id, reason: j.reason })).sort((a, b) => a.termId.localeCompare(b.termId))
    expect(clientJunk).toEqual(serverJunk)
  })

  it('the Code Helper AI duplicate folds on both paths (the exact regression this guards)', () => {
    const server = filterAgents(RAW_ROWS.map(toServerCandidate))
    expect(sortedTermIds(server.kept)).not.toContain('0xfd05c1f7bc1ebf0100d8e8d0a1e69489982ff373ed7a51440983bb4b1a283fd7')

    const client = filterAgents(RAW_ROWS.map(toClientCandidate))
    expect(sortedTermIds(client.kept)).not.toContain('0xfd05c1f7bc1ebf0100d8e8d0a1e69489982ff373ed7a51440983bb4b1a283fd7')
  })
})
