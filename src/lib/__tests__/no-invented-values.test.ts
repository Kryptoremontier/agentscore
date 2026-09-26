import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { apiToAgent } from '../profile-agent'
import { trustRatioOf } from '../evaluator-data'
import { calculateEvaluatorScore, type StakerPosition } from '../evaluator-score'
import type { AgentDetailApiItem } from '../api-data'
import { installFakeHasura } from './fake-hasura'

/**
 * Etap 4b-cache commit 3 — the last invented values the 4b-close follow-ups listed.
 */

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

const LUDA = '0x82d87d9517b68e653418c0e49805b36aca3e33a00536af25fc319f5c24802c5a'

describe('scored profile: no placeholder wallet', () => {
  const detail = {
    id: LUDA, name: 'Luda', rawLabel: '{"name":"Luda","description":"AI watch"}',
    score: { objectType: 'agent', trustScore: 70, qualityScore: null, objectScore: null, tier: 'good', softGateActive: false, computedAt: '' },
    scoreBasis: 'measured', agentScore: 70, trustTier: 'unverified', tierBasis: 'attestations',
    momentum: 0, momentumDirection: 'stable', supportStake: 0.00098, opposeStake: 0, stakerCount: 1, skillCount: 0,
    createdAt: '2026-03-01T00:00:00Z', supportRatio: 100, skillBreakdown: [], hasRadar: false,
  } as unknown as AgentDetailApiItem

  it('the detail has no owner/wallet (its creator is the FeeProxy) → walletAddress null, no owner; never 0x000…0', () => {
    const agent = apiToAgent(detail)
    expect(agent.walletAddress).toBeNull() // AgentHeader omits the Wallet row
    expect(agent).not.toHaveProperty('owner')
    expect(JSON.stringify(agent, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))).not.toMatch(/0x0{40}/)
  })
})

describe('evaluator: a zero-stake agent is not a verdict', () => {
  const TT = 10n ** 18n
  it('trustRatioOf: no stake at all → null (was 50 — the prior judged as a pick\'s outcome)', () => {
    expect(trustRatioOf({ positions_aggregate: { aggregate: { sum: { shares: '0' } } }, as_subject_triples: [] }, new Map())).toBeNull()
    expect(trustRatioOf({ positions_aggregate: { aggregate: { sum: { shares: '0' } } }, as_subject_triples: [{ counter_term_id: '0xc' }] }, new Map([['0xc', 0n]]))).toBeNull()
    expect(trustRatioOf({ positions_aggregate: { aggregate: { sum: { shares: String(TT) } } }, as_subject_triples: [] }, new Map())).toBe(100)
  })
  it('such a pick is left out of the track record, not counted', () => {
    const pos = (name: string, trust: number | null): StakerPosition => ({ agentAtomId: name, agentName: name, side: 'oppose', currentTrustScore: trust, isCreator: false })
    // An oppose pick on a 50 used to count as "wrong" (50 is not < 50); unmeasured, it isn't counted at all.
    expect(calculateEvaluatorScore('0xw', [pos('a', 30), pos('zero-stake', null)]).totalPositions).toBe(1)
  })
})

describe('/skills and /claims modals: loading is "—", never the engine\'s 50', () => {
  const src = (f: string) => readFileSync(path.join(__dirname, '../../app', f), 'utf8')
  it.each(['skills/page.tsx', 'claims/page.tsx'])('%s has no `score ?? 50` fallback', (f) => {
    const s = src(f)
    expect(s).not.toMatch(/score \?\? 50\b/)
    expect(s).not.toMatch(/currentScore=\{[^}]*\?\? 50\)/)
    expect(s).toMatch(/\{rawScore \?\? '—'\}/)
  })
})

describe('IntuForge: a failed atoms read is an error, never "no projects" / "syncing"', () => {
  it('project list read fails → rejects (was: [] → "No projects listed yet")', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    installFakeHasura({ tables: [], fail: () => 'throw' })
    const { fetchForgeProjectsWithJunkInfo, fetchForgeProjectsFromChain } = await import('../forge/data')
    await expect(fetchForgeProjectsWithJunkInfo(100)).rejects.toThrow()
    await expect(fetchForgeProjectsFromChain()).rejects.toThrow()
  })
  it('one project read fails → rejects (was: null → "syncing with indexer (~30s)")', async () => {
    installFakeHasura({ tables: [], fail: () => 'errors' })
    const { fetchForgeProjectById } = await import('../forge/data')
    await expect(fetchForgeProjectById('0xabc')).rejects.toThrow()
  })
  it('no such project → null (a complete read, still "not found")', async () => {
    installFakeHasura({ tables: [{ match: () => true, field: 'atoms', rows: [] }] })
    const { fetchForgeProjectById } = await import('../forge/data')
    await expect(fetchForgeProjectById('0xabc')).resolves.toBeNull()
  })
  it('the pages render their own error state for it', () => {
    const list = readFileSync(path.join(__dirname, '../../app/explore/intuforge/page.tsx'), 'utf8')
    const one = readFileSync(path.join(__dirname, '../../app/explore/intuforge/[id]/page.tsx'), 'utf8')
    expect(list).toMatch(/readFailed \? \(/)
    expect(one).toMatch(/if \(project === 'error'\)/)
  })
})
