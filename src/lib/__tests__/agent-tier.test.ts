import { describe, it, expect } from 'vitest'
import { calculateAgentTier, AGENT_TIER_LADDER, AGENT_TIER_BASIS } from '../agent-tier'
import { aggregateAttestations, type RawAttestation } from '../attestation-reader'
import { summarizeAttesters, type AttesterSummary } from '../agent-profile'
import { calculateTier } from '../trust-tiers'

/**
 * Thesis §6 "Agent tiers": an agent's tier is derived only from attestations —
 * distinct live attesters and tTRUST attested. Verified ≥ 3 / ≥ 0.1, Trusted
 * ≥ 2 / ≥ 0.05, otherwise Unverified. Backing never changes it.
 */

const WEI = 1_000_000_000_000_000_000n
const tt = (x: number) => (BigInt(Math.round(x * 1e6)) * WEI) / 1_000_000n // tTRUST → wei, exact to 1e-6
const CRYPTO = '0xecc2b1dce5f8269777d9001faa532642691d7038eed3c639f04895ac5b312d42'
const KNOWLEDGE = '0x8a0e3710014141458ee303a6cc504704ee3da370450d7f5cd5a898186a2f66e4'
const W = (i: number) => `0x${String(i).padStart(40, '0')}`

/** n attesters sharing `total` tTRUST attested equally, via the real aggregation path. */
function summary(n: number, total: number, extra: Array<[string, bigint]> = []): AttesterSummary[] {
  const each = n > 0 ? tt(total) / BigInt(n) : 0n
  const rem = n > 0 ? tt(total) - each * BigInt(n) : 0n
  const positions = Array.from({ length: n }, (_, i) => ({ wallet: W(i + 1), shares: each + (i === 0 ? rem : 0n) }))
  const raw: RawAttestation[] = [{
    tripleId: 't', agentId: '0xagent', agentName: 'A', domainTermId: CRYPTO,
    supportPositions: [...positions, ...extra.map(([wallet, shares]) => ({ wallet, shares }))],
    opposePositions: [],
  }]
  return summarizeAttesters(aggregateAttestations(raw))
}

describe('calculateAgentTier — the ladder', () => {
  it('0 attesters → Unverified (whatever backs the atom vault — backing is not an input)', () => {
    const r = calculateAgentTier([])
    expect(r.tier).toBe('unverified')
    expect(r.basis).toBe(AGENT_TIER_BASIS)
    expect(r.next).toEqual({ tier: 'trusted', ...AGENT_TIER_LADDER.trusted })
  })

  it('1 attester with 1.0 tTRUST → Unverified: one wallet can never lift an agent', () => {
    expect(calculateAgentTier(summary(1, 1.0)).tier).toBe('unverified')
  })

  it('2 attesters / 0.05 tTRUST → Trusted', () => {
    expect(calculateAgentTier(summary(2, 0.05)).tier).toBe('trusted')
  })

  it('2 attesters / 0.049 tTRUST → Unverified', () => {
    expect(calculateAgentTier(summary(2, 0.049)).tier).toBe('unverified')
  })

  it('3 attesters / 0.1 tTRUST → Verified', () => {
    const r = calculateAgentTier(summary(3, 0.1))
    expect(r.tier).toBe('verified')
    expect(r.next).toBeNull()
  })

  it('3 attesters / 0.099 tTRUST → Trusted', () => {
    expect(calculateAgentTier(summary(3, 0.099)).tier).toBe('trusted')
  })

  it('attesters are counted across domains once per wallet (distinct wallets, not rows)', () => {
    const raw: RawAttestation[] = [
      { tripleId: 'a', agentId: '0xa', agentName: 'A', domainTermId: CRYPTO, supportPositions: [{ wallet: W(1), shares: tt(0.05) }], opposePositions: [] },
      { tripleId: 'b', agentId: '0xa', agentName: 'A', domainTermId: KNOWLEDGE, supportPositions: [{ wallet: W(1), shares: tt(0.05) }], opposePositions: [] },
    ]
    const r = calculateAgentTier(summarizeAttesters(aggregateAttestations(raw)))
    expect(r.attesters).toBe(1) // one wallet in two domains is still one attester
    expect(r.tier).toBe('unverified')
  })
})

describe('calculateAgentTier — 0-share wallets never count', () => {
  it('2 live attesters + 5 sold-out wallets → still Trusted, never Verified', () => {
    const soldOut = Array.from({ length: 5 }, (_, i): [string, bigint] => [W(100 + i), 0n])
    const r = calculateAgentTier(summary(2, 0.2, soldOut))
    expect(r.attesters).toBe(2)
    expect(r.tier).toBe('trusted')
  })

  it('1 live attester + 2 sold-out wallets → Unverified', () => {
    expect(calculateAgentTier(summary(1, 0.5, [[W(100), 0n], [W(101), 0n]])).tier).toBe('unverified')
  })

  it('a hand-built summary with 0-share rows can\'t lift an agent either', () => {
    const handBuilt: AttesterSummary[] = [
      { wallet: W(1), domains: ['Crypto / Onchain'], totalStake: tt(1) },
      { wallet: W(2), domains: ['Crypto / Onchain'], totalStake: 0n },
      { wallet: W(3), domains: ['Crypto / Onchain'], totalStake: 0n },
    ]
    expect(calculateAgentTier(handBuilt)).toMatchObject({ tier: 'unverified', attesters: 1 })
  })
})

describe('calculateAgentTier — live agents, testnet 2026-09-26', () => {
  it('Captain Dackie (1 attester, 0.0099 tTRUST) → Unverified', () => {
    expect(calculateAgentTier(summary(1, 0.0099)).tier).toBe('unverified')
  })
  it('Luda (1 attester, 0.02079 tTRUST) → Unverified', () => {
    expect(calculateAgentTier(summary(1, 0.02079)).tier).toBe('unverified')
  })
  it('OPEN CLAW (0 attesters, 0.3351 tTRUST backing on its atom vault) → Unverified', () => {
    expect(calculateAgentTier([]).tier).toBe('unverified')
  })
})

describe('calculateTier (skills, claims, IntuForge projects, My Agents) is unchanged', () => {
  // Pinned outputs of the vault-based ladder those surfaces still use. Agent tiers moved to
  // calculateAgentTier; this table must not move with them.
  const cases: Array<[number, number, number, number, string]> = [
    // stakers, totalStake, trustRatio, ageDays → tier
    [0, 0, 0, 0, 'unverified'],
    [2, 0.5, 90, 60, 'unverified'],
    [3, 0.1, 0, 0, 'sandbox'],
    [3, 0.2249, 50, 3, 'sandbox'],
    [10, 1.0, 60, 7, 'trusted'],
    [10, 1.0, 59, 7, 'sandbox'],
    [24, 5.0, 75, 30, 'trusted'],
    [25, 5.0, 75, 30, 'verified'],
    [25, 5.0, 75, 29, 'trusted'],
    [100, 100, 100, 365, 'verified'],
  ]
  it.each(cases)('calculateTier(%d, %d, %d, %d) → %s', (stakers, stake, ratio, age, tier) => {
    expect(calculateTier(stakers, stake, ratio, age).tier).toBe(tier)
  })
})
