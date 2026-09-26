import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { installFakeHasura } from './fake-hasura'
import { annotateVaultReads } from '../agent-list'
import { stakeReadingOf, scoreUnlessOpposeUnread, hasMeasuredScore } from '../score-basis'
import { calculateTrustScoreFromStakes } from '../trust-score-engine'
import { calculateEvaluatorScore, type StakerPosition } from '../evaluator-score'

/**
 * Etap 4b-close commit 3 — a failed oppose read is unknown on every surface, not 0.
 * 4b-tier fixed the agent surfaces; /skills, /claims, evaluator data and IntuForge
 * still read a failed (or rate-limited: a 429 body has no `data`) oppose read as an
 * empty map, i.e. 0 oppose, i.e. an inflated score shown as measured.
 */

vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn, revalidateTag: () => {} }))

afterEach(() => vi.unstubAllGlobals())

const TT = 10n ** 17n

describe('/skills and /claims list rows — one annotation, one reading, one score rule', () => {
  it('skills: a failed oppose read → __opposeWei null → no score (was: support-only score, e.g. 100-ish)', () => {
    const skill = { term_id: '0xs', as_subject_triples: [{ counter_term_id: '0xc' }], positions_aggregate: { aggregate: { count: 2, sum: { shares: String(5n * TT) } } } } as any
    annotateVaultReads([skill], null, { stakers: false })
    const reading = stakeReadingOf(skill)
    expect(reading).toEqual({ supportWei: 5n * TT, opposeWei: null })
    const trust = calculateTrustScoreFromStakes(reading.supportWei ?? 0n, reading.opposeWei ?? 0n)
    expect(scoreUnlessOpposeUnread(trust, reading)).toBeNull()
    expect(hasMeasuredScore(reading)).toBe(false)
  })
  it('skills: a successful read keeps the real oppose and the score', () => {
    const skill = { term_id: '0xs', as_subject_triples: [{ counter_term_id: '0xc' }], positions_aggregate: { aggregate: { count: 2, sum: { shares: String(5n * TT) } } } } as any
    annotateVaultReads([skill], [{ id: '1', term_id: '0xc', account_id: '0x01', shares: String(5n * TT) }], { stakers: false })
    const reading = stakeReadingOf(skill)
    expect(reading.opposeWei).toBe(5n * TT)
    expect(scoreUnlessOpposeUnread(calculateTrustScoreFromStakes(5n * TT, 5n * TT), reading)).toBe(50)
  })
  it('claims: a claim is a triple — its own counter_term_id — and a failed read leaves it unknown', () => {
    const claim = { term_id: '0xt', counter_term_id: '0xct', positions_aggregate: { aggregate: { count: 1, sum: { shares: String(TT) } } } } as any
    annotateVaultReads([claim], null, { stakers: false, counterOf: (t: any) => t.counter_term_id })
    expect(claim.__opposeWei).toBeNull()
    expect(scoreUnlessOpposeUnread({ score: 99 }, stakeReadingOf(claim))).toBeNull()
  })
  it('the pages call those helpers — no local "?? 0n" oppose, no silent catch', () => {
    for (const f of ['src/app/skills/page.tsx', 'src/app/claims/page.tsx']) {
      const src = readFileSync(f, 'utf8')
      expect(src, f).toContain('annotateVaultReads(')
      expect(src, f).toContain('stakeReadingOf(')
      expect(src, f).toContain('scoreUnlessOpposeUnread(')
      expect(src, f).not.toMatch(/__opposeWei \?\? 0n/)
      expect(src, f).not.toMatch(/cards fall back to opposeWei=0/)
      expect(src, f).toContain('<OpposeUnreadNotice')
    }
    const skills = readFileSync('src/app/skills/page.tsx', 'utf8')
    // The modal's own oppose read: a failure is unknown, never recomputed with 0n.
    expect(skills).toContain('setSkillOpposeUnread(true)')
    expect(skills).not.toMatch(/\.catch\(\(\) => \{\s*setSkillTrust\(calculateTrustScoreFromStakes\(supportWei, 0n\)\)/)
    const claims = readFileSync('src/app/claims/page.tsx', 'utf8')
    expect(claims).toContain('setClaimSupplyUnread(true)')
    expect(claims).not.toMatch(/claim\.trust_score \?\? 0\b/)
  })
})

describe('evaluator data — a pick whose agent trust is unknown is not judged', () => {
  it('trustRatioOf: failed oppose read → null (was: support/(support+0) = 100 → every support pick "correct")', async () => {
    const { trustRatioOf } = await import('../evaluator-data')
    const atom = { positions_aggregate: { aggregate: { sum: { shares: String(3n * TT) } } }, as_subject_triples: [{ counter_term_id: '0xc' }] }
    expect(trustRatioOf(atom, null)).toBeNull()
    expect(trustRatioOf(atom, new Map([['0xc', 1n * TT]]))).toBe(75)
    expect(trustRatioOf({ ...atom, as_subject_triples: [] }, null)).toBe(100) // no counter-vault: nothing to oppose
  })
  it('calculateEvaluatorScore leaves unknown picks out (no PNL + null trust) instead of scoring them', () => {
    const pos = (name: string, trust: number | null): StakerPosition => ({ agentAtomId: name, agentName: name, side: 'support', currentTrustScore: trust, isCreator: false })
    const withUnknown = calculateEvaluatorScore('0xw', [pos('a', 80), pos('b', null), pos('c', null)])
    const known = calculateEvaluatorScore('0xw', [pos('a', 80)])
    expect(withUnknown.totalPositions).toBe(1)
    expect(withUnknown.goodPicks).toBe(known.goodPicks)
    expect(withUnknown.evaluatorWeight).toBe(known.evaluatorWeight)
  })
  it('fetchStakerPositions: oppose read rate-limited → currentTrustScore null, not 100', async () => {
    const { fetchStakerPositions } = await import('../evaluator-data')
    installFakeHasura({
      tables: [{ match: (q) => q.includes('VaultPositions'), field: 'positions', rows: [] }],
      other: (q) => q.includes('as_subject_triples') && !q.includes('VaultPositions')
        ? { atoms: [{ term_id: '0xagent', label: 'Agent: A', creator: { id: '0x0' }, positions_aggregate: { aggregate: { sum: { shares: String(TT) } } }, as_subject_triples: [{ counter_term_id: '0xc' }] }] }
        : q.includes('positions') ? { positions: [] } : undefined,
      fail: (q) => (q.includes('VaultPositions') ? 'rate-limit' : undefined),
    })
    const out = await fetchStakerPositions('0x139219107C1eBE569f543C581b3B807Cf6740006')
    expect(out.map((p) => p.currentTrustScore)).toEqual([null])
  })
})

describe('IntuForge — an unknown oppose leaves the project unscored, never scored on 0', () => {
  const atom = (id: string, name: string, counter: string) => ({
    term_id: id, data: JSON.stringify({ type: 'IntuitionProject', name, tagline: 't', description: 'd', category: 'defi', stage: 'mvp' }), created_at: '2026-06-01T00:00:00Z',
    creator: { id: '0xabc' }, positions_aggregate: { aggregate: { count: 2, sum: { shares: String(4n * TT) } } },
    type_triple: [{ term_id: `${id}-type`, counter_term_id: counter }], metadata_triple: [],
  })
  const fakeForge = (opposeFails: boolean) => installFakeHasura({
    tables: [{ match: (q) => q.includes('VaultPositions'), field: 'positions', rows: [{ id: '1', term_id: '0xcA', account_id: '0x01', shares: String(TT) }] }],
    other: (q) => (q.includes('Intuition Project') ? { atoms: [atom('0xA', 'Alpha', '0xcA'), atom('0xB', 'Beta', '0xcB')] } : undefined),
    fail: (q) => (opposeFails && q.includes('VaultPositions') ? 'rate-limit' : undefined),
  })
  it('oppose read fails → finalScore / trustScore / compositeScore / opposeStaked null; score envelope null', async () => {
    fakeForge(true)
    const { fetchForgeProjectsFromChain } = await import('../forge/data')
    const { getForgeProjectScore } = await import('../forge/scoring')
    const projects = await fetchForgeProjectsFromChain()
    expect(projects.length).toBe(2)
    for (const p of projects) {
      expect(p).toMatchObject({ finalScore: null, trustScore: null, compositeScore: null, opposeStaked: null, sparklineData: [] })
      expect(getForgeProjectScore(p)).toBeNull()
    }
  })
  it('oppose read ok → real oppose and scores (control)', async () => {
    fakeForge(false)
    const { fetchForgeProjectsFromChain } = await import('../forge/data')
    const byName = new Map((await fetchForgeProjectsFromChain()).map((p) => [p.name, p]))
    expect(byName.get('Alpha')?.opposeStaked).toBeCloseTo(0.1)
    expect(byName.get('Beta')?.opposeStaked).toBe(0)
    expect(typeof byName.get('Alpha')?.finalScore).toBe('number')
  })
  it('ranking puts unknown scores last; the average is over known scores only (null when none)', async () => {
    const { compareForgeScoreDesc, meanKnownForgeScore } = await import('../forge/scoring')
    const rows = [{ name: 'u', finalScore: null }, { name: 'lo', finalScore: 20 }, { name: 'hi', finalScore: 90 }]
    expect([...rows].sort(compareForgeScoreDesc).map((r) => r.name)).toEqual(['hi', 'lo', 'u'])
    expect(meanKnownForgeScore(rows)).toBe(55)
    expect(meanKnownForgeScore([{ finalScore: null }])).toBeNull()
  })
})
