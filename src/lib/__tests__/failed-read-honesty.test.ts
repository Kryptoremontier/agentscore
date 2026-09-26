import { describe, it, expect, vi, afterEach } from 'vitest'
import { installFakeHasura } from './fake-hasura'
import { fetchAgentProfileVector, fetchAgentBackers } from '../agent-profile'
import { fetchAgentSkillTriples } from '../intuition'
import { fetchVaultPositions } from '../vault-positions'
import { fetchTimelineData } from '../timeline-data'

/**
 * REPO_MAP §7 rule 5 — a failed read is not an empty one. Paging (f6c0f35) made
 * every read several requests against an endpoint that rate-limits; the readers
 * that caught the pager's throw and returned [] then printed a failure as a fact:
 * "No one has attested this agent", "No reports on-chain", no skills (REST detail
 * answered 200 with a different score).
 */

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

const AGENT = '0x45078ae569def2264355f77e592028dd6f1f5d6373c204fe82bf3141ab1861fb'

describe('fetchAgentProfileVector — a failed part is null, not []', () => {
  it('attestation read fails → attested null (the modal says "couldn\'t read"), reports still read', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    installFakeHasura({
      tables: [{ match: (q) => q.includes('GetAgentReport'), field: 'triples', rows: [] }],
      fail: (q) => (q.includes('GetAttestationTriple') ? 'throw' : undefined),
    })
    const v = await fetchAgentProfileVector(AGENT)
    expect(v.attested).toBeNull()
    expect(v.reports).toEqual([])
  })

  it('reports read fails → reports null, attestations still read', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    installFakeHasura({
      tables: [{ match: (q) => q.includes('GetAttestationTriple'), field: 'triples', rows: [] }],
      fail: (q) => (q.includes('GetAgentReport') ? 'throw' : undefined),
    })
    const v = await fetchAgentProfileVector(AGENT)
    expect(v.attested).toEqual([])
    expect(v.reports).toBeNull()
  })

  it('backers read fails → null, never [] ("No positions on this agent\'s vault")', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    installFakeHasura({ tables: [], fail: () => 'throw' })
    expect(await fetchAgentBackers(AGENT)).toBeNull()
  })
})

describe('fetchAgentSkillTriples — a failed read throws (was [] → REST 200 with the skills and score changed)', () => {
  it('rejects when a positions page fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    installFakeHasura({
      tables: [{ match: (q) => q.includes('GetAgentAllTriples'), field: 'triples', rows: [{ term_id: '0xt', counter_term_id: null, predicate: { term_id: '0xp', label: 'hasAgentSkill' }, object: { term_id: '0xs', label: 'Skill: x' } }] }],
      fail: (q) => (q.includes('VaultPositions') ? 'throw' : undefined),
    })
    await expect(fetchAgentSkillTriples(AGENT)).rejects.toThrow()
  })
})

describe('fetchVaultPositions — pages by immutable id, orders after the full read', () => {
  it('a trade between two page requests neither drops nor repeats a wallet (it would, paging on shares)', async () => {
    let reads = 0
    const wallets = Array.from({ length: 150 }, (_, i) => `0xw${String(i).padStart(3, '0')}`)
    const fake = installFakeHasura({
      tables: [{
        match: (q) => q.includes('VaultPositions'),
        field: 'positions',
        rows: (q) => {
          // After the first row page, wallet 10 sells down to 1 share (its shares-order rank moves).
          if (!q.includes('_aggregate')) reads++
          return wallets.map((w, i) => ({
            id: `0xvault-1-${w}`, term_id: '0xvault', account_id: w,
            shares: String(i === 10 && reads > 1 ? 1 : 1000 - i),
          }))
        },
      }],
    })
    const rows = await fetchVaultPositions(['0xvault'], { order: 'shares-desc' })
    expect(new Set(rows.map((r) => r.account_id)).size).toBe(150)
    expect(fake.rowCalls('positions').every((c) => /order_by:\s*\{\s*id:\s*asc\s*\}/.test(c.query))).toBe(true)
    // …and the requested order is applied to what was read (wallet 10 was read on page 1,
    // before its trade, so the smallest position read is wallet 149's).
    expect(rows[0].account_id).toBe('0xw000')
    expect(rows[rows.length - 1].account_id).toBe('0xw149')
  })
})

describe('fetchTimelineData — events past the endpoint caps are all read', () => {
  it('300 signals (250 per request) → 300 staking events, oldest first — not the oldest 200', async () => {
    const signals = Array.from({ length: 300 }, (_, i) => ({
      id: `0xtx${String(i).padStart(4, '0')}-0`, delta: '1000', account_id: '0xa', term_id: AGENT,
      created_at: `2026-01-01T00:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}Z`,
      deposit_id: 'd', redemption_id: null,
    }))
    installFakeHasura({
      tables: [
        { match: (q) => q.includes('GetAgentSignals'), field: 'signals', rows: signals },
        { match: (q) => q.includes('SkillTriples'), field: 'triples', rows: [] },
      ],
      other: () => ({ atom: [{ label: 'Captain Dackie', created_at: '2026-01-01T00:00:00Z', as_subject_triples: [] }] }),
    })
    const t = await fetchTimelineData(AGENT)
    expect(t?.stakingEvents).toHaveLength(300)
  })
})
