import { describe, it, expect } from 'vitest'
import {
  resolveReportCategory,
  aggregateReports,
  aggregateBackers,
  summarizeAttesters,
  profileSections,
  type RawReportRow,
  type PositionRow,
} from '../agent-profile'
import { aggregateAttestations, type RawAttestation } from '../attestation-reader'

const KNOWLEDGE = '0x8a0e3710014141458ee303a6cc504704ee3da370450d7f5cd5a898186a2f66e4'
const CRYPTO = '0xecc2b1dce5f8269777d9001faa532642691d7038eed3c639f04895ac5b312d42'
const W1 = '0x139219107C1eBE569f543C581b3B807Cf6740006'
const W2 = '0x048f2ed104c2B979d8fdFDA692C682cDCCcCE71b'
const AGENT = '0x45078ae569def2264355f77e592028dd6f1f5d6373c204fe82bf3141ab1861fb'
const COUNTER = '0x2fa8f846b504ad6e3bd24f2282c53bb194eb667354bacbd6cf054686ac19823f'

const att = (agentId: string, domain: string, positions: Array<[string, bigint]>): RawAttestation => ({
  tripleId: `t-${agentId}-${domain}`,
  agentId,
  agentName: 'A',
  domainTermId: domain,
  supportPositions: positions.map(([wallet, shares]) => ({ wallet, shares })),
  opposePositions: [],
})

describe('attestation-reader — per-attester stake (agent-filtered aggregation)', () => {
  it('sums a wallet\'s positions into one attesterStakes row, aligned with attesters', () => {
    const [e] = aggregateAttestations([att(AGENT, CRYPTO, [[W1, 5n], [W1.toLowerCase(), 7n], [W2, 1n]])])
    expect(e.distinctAttesters).toBe(2)
    expect(e.attesters).toEqual([W1, W2])
    expect(e.attesterStakes).toEqual([{ wallet: W1, shares: 12n }, { wallet: W2, shares: 1n }])
    expect(e.totalStake).toBe(13n)
  })
})

describe('summarizeAttesters — according to WHOM, across domains', () => {
  it('dedups a wallet across domains and lists every domain it attested', () => {
    const entries = aggregateAttestations([
      att(AGENT, CRYPTO, [[W1, 10n]]),
      att(AGENT, KNOWLEDGE, [[W1.toLowerCase(), 4n], [W2, 20n]]),
    ])
    const s = summarizeAttesters(entries)
    expect(s).toHaveLength(2)
    expect(s[0]).toEqual({ wallet: W2, domains: ['Knowledge / Productivity'], totalStake: 20n })
    // first-seen casing is preserved; identity is case-insensitive
    expect(s[1].wallet.toLowerCase()).toBe(W1.toLowerCase())
    expect([...s[1].domains].sort()).toEqual(['Crypto / Onchain', 'Knowledge / Productivity'])
    expect(s[1].totalStake).toBe(14n)
  })

  it('returns [] for no attestations', () => {
    expect(summarizeAttesters([])).toEqual([])
  })
})

describe('resolveReportCategory', () => {
  it('reads the canonical form from the object label', () => {
    expect(resolveReportCategory('reported for', 'Phishing')).toBe('Phishing')
  })
  it('reads the testnet-era form from the predicate suffix', () => {
    expect(resolveReportCategory('reported_for_prompt_injection', 'some reason text')).toBe('Prompt injection')
  })
  it('never returns an empty category', () => {
    expect(resolveReportCategory(null, null)).toBe('Unspecified')
  })
})

describe('aggregateReports — who + how much, newest first', () => {
  const row = (id: string, created: string, objectLabel: string, creator = '0x2f76eF07Df7b3904c1350e24Ad192e507fd4ec41'): RawReportRow => ({
    term_id: id,
    created_at: created,
    creator_id: creator,
    predicate: { term_id: '0x51f1', label: 'reported for' },
    object: { term_id: '0xobj', label: objectLabel },
  })
  const pos = (term: string, wallet: string, shares: string): PositionRow => ({ term_id: term, account_id: wallet, shares })

  it('attributes the report to the first staker, not the FeeProxy creator, and sums stake', () => {
    const out = aggregateReports([row('r1', '2026-08-11T21:57:35Z', 'Phishing')], [pos('r1', W2, '5'), pos('r1', W1, '3')])
    expect(out).toHaveLength(1)
    expect(out[0].reporter).toBe(W2)
    expect(out[0].stakeWei).toBe(8n)
    expect(out[0].category).toBe('Phishing')
  })

  it('falls back to creator_id when the triple has no positions', () => {
    const out = aggregateReports([row('r1', '2026-08-11T21:57:35Z', 'Scam', W1)], [])
    expect(out[0].reporter).toBe(W1)
    expect(out[0].stakeWei).toBe(0n)
  })

  it('sorts newest first', () => {
    const out = aggregateReports([row('old', '2026-07-01T00:00:00Z', 'Scam'), row('new', '2026-08-01T00:00:00Z', 'Spam')], [])
    expect(out.map((r) => r.tripleId)).toEqual(['new', 'old'])
  })

  it('empty state: no rows → []', () => {
    expect(aggregateReports([], [])).toEqual([])
  })
})

describe('aggregateBackers — staking on the agent is NOT attesting competence', () => {
  const pos = (term: string, wallet: string, shares: string): PositionRow => ({ term_id: term, account_id: wallet, shares })

  it('splits support (own vault) and oppose (counter-vault) per wallet, dedup case-insensitive', () => {
    const out = aggregateBackers(
      [pos(AGENT, W1, '10'), pos(AGENT, W1.toLowerCase(), '5'), pos(COUNTER, W2, '4'), pos(AGENT, W2, '1')],
      AGENT,
      COUNTER,
    )
    expect(out).toHaveLength(2)
    expect(out[0]).toMatchObject({ wallet: W1, supportShares: 15n, opposeShares: 0n })
    expect(out[1]).toMatchObject({ wallet: W2, supportShares: 1n, opposeShares: 4n })
  })

  it('ignores positions on unrelated vaults (e.g. an attestation triple) and zero-share rows', () => {
    const out = aggregateBackers([pos('0xsomeTriple', W1, '99'), pos(AGENT, W2, '0')], AGENT, null)
    expect(out).toEqual([])
  })

  it('OPEN CLAW shape: one real backer, no attestations → backer kept, not dropped', () => {
    const out = aggregateBackers([pos(AGENT, W1, '335060865858275579')], AGENT, null)
    expect(out).toHaveLength(1)
    expect(out[0].supportShares).toBe(335060865858275579n)
  })
})

describe('profileSections — ATTESTED > DECLARED > REPORTS hierarchy', () => {
  it('always orders attested first, declared second, reports last', () => {
    expect(profileSections({ attestedCount: 3, declaredCount: 2, reportCount: 1 }).order).toEqual(['attested', 'declared', 'reports'])
  })
  it('zero attestations → attested empty state (be the first), reports empty line', () => {
    const p = profileSections({ attestedCount: 0, declaredCount: 0, reportCount: 0 })
    expect(p.attestedEmpty).toBe(true)
    expect(p.declaredHidden).toBe(true)
    expect(p.reportsEmpty).toBe(true)
  })
  it('declared is hidden (not an empty state) for non-cohort agents; attested empty state still shows', () => {
    const p = profileSections({ attestedCount: 0, declaredCount: 0, reportCount: 2 })
    expect(p.declaredHidden).toBe(true)
    expect(p.attestedEmpty).toBe(true)
    expect(p.reportsEmpty).toBe(false)
  })
})
