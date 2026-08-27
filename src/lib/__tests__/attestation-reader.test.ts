import { describe, it, expect } from 'vitest'
import {
  aggregateAttestations,
  scoreAttestation,
  truncateWallet,
  DISTINCT_ATTESTER_WEIGHT,
  STAKE_POINTS_CAP,
  STAKE_SCALE_WEI,
  type RawAttestation,
  type AttesterPosition,
} from '../attestation-reader'

// The Knowledge / Productivity canonical bucket atom (canonical-domains.ts).
const KNOWLEDGE_BUCKET_ID = '0x8a0e3710014141458ee303a6cc504704ee3da370450d7f5cd5a898186a2f66e4'
const CRYPTO_BUCKET_ID = '0xecc2b1dce5f8269777d9001faa532642691d7038eed3c639f04895ac5b312d42'

const WALLET_A = '0x1392aBcDeF00112233445566778899aabb000006'
const WALLET_B = '0x2f76eF07Df7b3904c1350e24Ad192e507fd4ec41'

const STAKE = 100_000_000_000_000n // 0.0001 tTRUST

const P = (wallet: string, shares: bigint = STAKE): AttesterPosition => ({ wallet, shares })

const A = (
  agentId: string,
  domainTermId: string,
  supportPositions: AttesterPosition[],
  opposePositions: AttesterPosition[] = [],
): RawAttestation => ({
  tripleId: `triple-${agentId}-${domainTermId}`,
  agentId,
  agentName: `Agent ${agentId}`,
  domainTermId,
  supportPositions,
  opposePositions,
})

describe('aggregateAttestations — dedup by wallet (sybil-safe)', () => {
  it('counts multiple positions from the SAME wallet as 1 distinct attester', () => {
    const res = aggregateAttestations([
      A('0xluda', KNOWLEDGE_BUCKET_ID, [P(WALLET_A), P(WALLET_A)]),
    ])
    expect(res).toHaveLength(1)
    expect(res[0].distinctAttesters).toBe(1)
    expect(res[0].positionCount).toBe(2)
    expect(res[0].totalStake).toBe(2n * STAKE)
    expect(res[0].attesters).toEqual([WALLET_A])
  })

  it('dedups case-variant addresses of the same wallet', () => {
    const res = aggregateAttestations([
      A('0xluda', KNOWLEDGE_BUCKET_ID, [P(WALLET_A), P(WALLET_A.toLowerCase())]),
    ])
    expect(res[0].distinctAttesters).toBe(1)
    // first-seen casing preserved for display
    expect(res[0].attesters).toEqual([WALLET_A])
  })

  it('counts distinct wallets independently', () => {
    const res = aggregateAttestations([
      A('0xluda', KNOWLEDGE_BUCKET_ID, [P(WALLET_A), P(WALLET_B)]),
    ])
    expect(res[0].distinctAttesters).toBe(2)
    expect(res[0].attesters).toHaveLength(2)
  })
})

describe('aggregateAttestations — aggregation semantics', () => {
  it('merges multiple triples for the same (agent, domain) pair', () => {
    const res = aggregateAttestations([
      A('0xluda', KNOWLEDGE_BUCKET_ID, [P(WALLET_A)]),
      A('0xluda', KNOWLEDGE_BUCKET_ID, [P(WALLET_B)]),
    ])
    expect(res).toHaveLength(1)
    expect(res[0].distinctAttesters).toBe(2)
  })

  it('keeps separate (agent, domain) pairs separate', () => {
    const res = aggregateAttestations([
      A('0xluda', KNOWLEDGE_BUCKET_ID, [P(WALLET_A)]),
      A('0xluda', CRYPTO_BUCKET_ID, [P(WALLET_A)]),
      A('0xother', KNOWLEDGE_BUCKET_ID, [P(WALLET_B)]),
    ])
    expect(res).toHaveLength(3)
  })

  it('separates oppose stake from support stake', () => {
    const res = aggregateAttestations([
      A('0xluda', KNOWLEDGE_BUCKET_ID, [P(WALLET_A)], [P(WALLET_B, 5n * STAKE)]),
    ])
    expect(res[0].totalStake).toBe(STAKE)
    expect(res[0].opposeStake).toBe(5n * STAKE)
    // oppose wallets are NOT attesters
    expect(res[0].distinctAttesters).toBe(1)
  })

  it('skips rows whose domain is not in the canonical registry', () => {
    const res = aggregateAttestations([
      A('0xluda', '0xnot-a-canonical-bucket', [P(WALLET_A)]),
    ])
    expect(res).toEqual([])
  })

  it('returns [] for empty input', () => {
    expect(aggregateAttestations([])).toEqual([])
  })

  it('yields NO entry for a triple with zero support positions (stake fully redeemed)', () => {
    // Live testnet case: 9ytshade.eth → Social triple exists with no positions.
    const res = aggregateAttestations([
      A('0x9ytshade', '0x9c7db27885e2e35f9a2f674943f61b02f321ea22d91dd48dea6d82647f884a91', []),
    ])
    expect(res).toEqual([])
  })

  it('resolves the domain to the full registry definition', () => {
    const res = aggregateAttestations([A('0xluda', KNOWLEDGE_BUCKET_ID, [P(WALLET_A)])])
    expect(res[0].domain.label).toBe('Knowledge / Productivity')
    expect(res[0].domain.termId).toBe(KNOWLEDGE_BUCKET_ID)
  })
})

describe('scoreAttestation — v1 (independence dominates money)', () => {
  it('N+1 attesters always outrank N attesters regardless of stake size', () => {
    const oneAttesterHugeStake = scoreAttestation(1, 1_000_000_000_000_000_000_000_000n)
    const twoAttestersMinStake = scoreAttestation(2, 2n * STAKE)
    expect(twoAttestersMinStake).toBeGreaterThan(oneAttesterHugeStake)
  })

  it('stake points are capped below one attester weight', () => {
    expect(STAKE_POINTS_CAP).toBeLessThan(DISTINCT_ATTESTER_WEIGHT)
    const maxStakeScore = scoreAttestation(0, 10n ** 30n)
    expect(maxStakeScore).toBeLessThanOrEqual(STAKE_POINTS_CAP)
  })

  it('zero attesters, zero stake → 0', () => {
    expect(scoreAttestation(0, 0n)).toBe(0)
  })

  it('more stake at equal attesters → higher-or-equal score (monotone)', () => {
    const low = scoreAttestation(1, STAKE)
    const high = scoreAttestation(1, 1000n * STAKE)
    expect(high).toBeGreaterThanOrEqual(low)
  })

  it('anchors the log curve at STAKE_SCALE_WEI (score ~10.3 for 1 min-stake attester)', () => {
    expect(scoreAttestation(1, STAKE_SCALE_WEI)).toBeCloseTo(10.3, 1)
  })
})

describe('aggregateAttestations — ordering', () => {
  it('sorts by score desc, ties by agent name', () => {
    const res = aggregateAttestations([
      A('0xzeta', KNOWLEDGE_BUCKET_ID, [P(WALLET_A)]),
      A('0xalpha', CRYPTO_BUCKET_ID, [P(WALLET_A)]),
      A('0xtop', KNOWLEDGE_BUCKET_ID, [P(WALLET_A), P(WALLET_B)]),
    ])
    expect(res[0].agentId).toBe('0xtop')
    expect(res[1].agentName < res[2].agentName).toBe(true)
  })
})

describe('truncateWallet', () => {
  it('truncates to the 0x1392...0006 form', () => {
    expect(truncateWallet(WALLET_A)).toBe('0x1392...0006')
  })

  it('passes short strings through', () => {
    expect(truncateWallet('0xabc')).toBe('0xabc')
    expect(truncateWallet('')).toBe('')
  })
})
