import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { installFakeHasura } from './fake-hasura'
import { qualityCacheClear } from '../scoring/quality-cache'
import { buildAgentTimeline, type StakingEvent } from '../trust-timeline'
import { fetchAttestations, fetchAttestationsForSubjects, ATTESTATION_SUBJECT_CHUNK } from '../attestation-reader'

/**
 * Every agent surface takes its tier from calculateAgentTier (thesis §6 "Agent
 * tiers") — here the machine-read ones (REST/MCP read getAgentsWithScores,
 * getAgentDetail and getAgentTrustBreakdown) and the timeline. The ladder itself
 * is tested in agent-tier.test.ts.
 */

vi.mock('../evaluator-data', () => ({
  fetchEvaluatorLeaderboard: vi.fn(async () => []),
  fetchStakerPositions: vi.fn(async () => []),
}))
// getOnChainSharePrice would hit the RPC; the breakdown tolerates a null price.
vi.mock('../on-chain-pricing', () => ({ getOnChainSharePrice: vi.fn(async () => null) }))

const WHALE = '0x0d579846f21a66f35efafb2339d182e27560ec9f9d8ea64f7f1d9929d20a2d7d' // huge vault, 0 attesters
const TWO = '0x82d87d9517b68e653418c0e49805b36aca3e33a00536af25fc319f5c24802c5a'   // 2 attesters, 0.05 tTRUST
const CRYPTO = '0xecc2b1dce5f8269777d9001faa532642691d7038eed3c639f04895ac5b312d42'
const W = (i: number) => `0x${String(i).padStart(40, '0')}`
const tt = (x: number) => String(BigInt(Math.round(x * 1e6)) * 10n ** 12n)

const atom = (term_id: string, label: string, shares: string) => ({
  term_id, label, data: null, type: 'Thing', emoji: null, created_at: '2026-01-01T00:00:00+00:00',
  creator: { label: 'x', id: '0x0' },
  positions_aggregate: { aggregate: { sum: { shares }, max: { created_at: '2026-01-01T00:00:00+00:00' } } },
  as_subject_triples: [],
})
const ATOMS = [atom(WHALE, 'Agent: Whale Backed', tt(1000)), atom(TWO, 'Agent: Two Attesters', tt(0.001))]
const TRIPLE = { term_id: '0xtriple-two', counter_term_id: null, subject: { term_id: TWO, label: 'Two Attesters' }, object: { term_id: CRYPTO } }
const POSITIONS = [
  // 50 wallets backing the whale's atom vault with 20 tTRUST each: backing, not attesting.
  ...Array.from({ length: 50 }, (_, i) => ({ id: `${WHALE}-1-${W(i + 100)}`, term_id: WHALE, account_id: W(i + 100), shares: tt(20) })),
  { id: `0xtriple-two-1-${W(1)}`, term_id: '0xtriple-two', account_id: W(1), shares: tt(0.03) },
  { id: `0xtriple-two-1-${W(2)}`, term_id: '0xtriple-two', account_id: W(2), shares: tt(0.02) },
]

function fake(opts: { attestationsFail?: boolean } = {}) {
  return installFakeHasura({
    tables: [
      {
        match: (q) => q.includes('ApiAgent'),
        field: 'atoms',
        // The single-agent read filters by $id; the corpus read takes them all.
        rows: (_q, v) => (typeof v.id === 'string' ? ATOMS.filter((a) => a.term_id === v.id) : ATOMS),
      },
      { match: (q) => q.includes('GetAttestationTriple'), field: 'triples', rows: (_q, v) => (Array.isArray(v.subjects) && !v.subjects.includes(TWO) ? [] : [TRIPLE]) },
      { match: (q) => q.includes('VaultPositions'), field: 'positions', rows: (_q, v) => POSITIONS.filter((p) => (v.vaultIds as string[]).includes(p.term_id)) },
      { match: (q) => q.includes('GetAgentAllTriples'), field: 'triples', rows: [] },
    ],
    other: (q) => (q.includes('signals') ? { signals: [] } : undefined),
    fail: (q) => (opts.attestationsFail && q.includes('GetAttestationTriple') ? 'throw' : undefined),
  })
}

beforeEach(() => qualityCacheClear())
afterEach(() => vi.unstubAllGlobals())

describe('REST/MCP agent tier — attestations only', () => {
  it('list: 1000 tTRUST of backing from 50 wallets and 0 attesters → Unverified; 2 attesters / 0.05 → Trusted', async () => {
    fake()
    const { getAgentsWithScores } = await import('../api-data')
    const { agents } = await getAgentsWithScores({ limit: 10 })
    const byId = new Map(agents.map((a) => [a.id, a]))
    expect(byId.get(WHALE)).toMatchObject({ trustTier: 'unverified', tierBasis: 'attestations', stakerCount: 50 })
    expect(byId.get(TWO)).toMatchObject({ trustTier: 'trusted', tierBasis: 'attestations' })
  })

  it('list: a failed attestation read → trustTier null (unknown), never a substituted "unverified"', async () => {
    fake({ attestationsFail: true })
    const { getAgentsWithScores } = await import('../api-data')
    const { agents } = await getAgentsWithScores({ limit: 10 })
    expect(agents.map((a) => a.trustTier)).toEqual([null, null])
    expect(agents.every((a) => a.tierBasis === 'attestations')).toBe(true)
  })

  it('detail: same tier as the list for the same agent', async () => {
    fake()
    const { getAgentDetail } = await import('../api-data')
    expect((await getAgentDetail(TWO))?.trustTier).toBe('trusted')
    expect((await getAgentDetail(WHALE))?.trustTier).toBe('unverified')
  })

  it('trust breakdown: tier.current/basis and what the next rung needs (attesters, tTRUST attested)', async () => {
    fake()
    const { getAgentTrustBreakdown } = await import('../api-data')
    const whale = await getAgentTrustBreakdown(WHALE)
    expect(whale?.tier).toEqual({
      current: 'unverified', basis: 'attestations', nextTier: 'trusted',
      requirements: { attesters: '0/2', tTrustAttested: '0.0000/0.05 tTRUST' },
    })
    const two = await getAgentTrustBreakdown(TWO)
    expect(two?.tier).toEqual({
      current: 'trusted', basis: 'attestations', nextTier: 'verified',
      requirements: { attesters: '2/3', tTrustAttested: '0.0500/0.1 tTRUST' },
    })
  })
})

describe('fetchAttestationsForSubjects — the list/REST read', () => {
  it('chunks subjects at 200 (two paged requests per chunk, never one per row) and keys every id', async () => {
    const f = fake()
    const ids = [TWO, ...Array.from({ length: 449 }, (_, i) => `0xsubject${i}`)]
    const map = await fetchAttestationsForSubjects(ids)
    const tripleReads = f.rowCalls('triples').filter((c) => c.query.includes('GetAttestationTriples('))
    expect(tripleReads).toHaveLength(Math.ceil(ids.length / ATTESTATION_SUBJECT_CHUNK))
    expect(tripleReads.every((c) => (c.variables.subjects as string[]).length <= ATTESTATION_SUBJECT_CHUNK)).toBe(true)
    expect(map.size).toBe(450)
    expect(map.get('0xsubject7')).toEqual([])
    expect(map.get(TWO)?.[0].distinctAttesters).toBe(2)
  })

  it('list and modal agree: the bulk read and fetchAttestations({ subjectId }) give identical entries', async () => {
    fake()
    const bulk = (await fetchAttestationsForSubjects([TWO, WHALE]))
    expect(bulk.get(TWO)).toEqual(await fetchAttestations({ subjectId: TWO }))
    expect(bulk.get(WHALE)).toEqual(await fetchAttestations({ subjectId: WHALE }))
  })

  it('a failed chunk rejects — a partial map is never returned as complete', async () => {
    fake({ attestationsFail: true })
    await expect(fetchAttestationsForSubjects([TWO])).rejects.toThrow()
  })
})

describe('agent timelines emit no staker-count "tier upgrade" events', () => {
  const deposits: StakingEvent[] = Array.from({ length: 26 }, (_, i) => ({
    id: `d${i}`, accountId: W(i), type: 'deposit', side: 'support', deltaWei: '1', timestamp: `2026-03-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
  }))
  it("tierMilestones 'none' (agents) → no tier_upgrade at 3/10/25 supporters", () => {
    const tl = buildAgentTimeline({ agentId: 'a', agentName: 'A', currentScore: 60, currentTier: 'unverified', tierMilestones: 'none', stakingEvents: deposits, skillEvents: [] })
    expect(tl.events.filter((e) => e.type === 'tier_upgrade')).toEqual([])
  })
  it('default (IntuForge, skills, claims) is unchanged: 3 milestones', () => {
    const tl = buildAgentTimeline({ agentId: 'a', agentName: 'A', currentScore: 60, currentTier: 'trusted', stakingEvents: deposits, skillEvents: [] })
    expect(tl.events.filter((e) => e.type === 'tier_upgrade').map((e) => e.metadata?.tier)).toEqual(['Verified', 'Trusted', 'Sandbox'])
  })
})
