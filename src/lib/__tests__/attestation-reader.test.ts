import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  aggregateAttestations,
  fetchAttestations,
  isLivePosition,
  scoreAttestation,
  truncateWallet,
  DISTINCT_ATTESTER_WEIGHT,
  STAKE_POINTS_CAP,
  STAKE_SCALE_WEI,
  type RawAttestation,
  type AttesterPosition,
} from '../attestation-reader'
import { installFakeHasura } from './fake-hasura'

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

  it('yields NO entry for a triple with zero support positions', () => {
    // Live testnet case: 9ytshade.eth → Social triple exists and was never staked (no deposit indexed).
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

describe('a wallet that sold out is not an attester (thesis §4 rule 5, §8 mine 6)', () => {
  // The indexer keeps a position row after a full redeem, with shares "0" — 477 such rows
  // on testnet 2026-09-26. Having a row is not attesting; holding shares is.
  it('isLivePosition: shares > 0 only', () => {
    expect(isLivePosition({ shares: 1n })).toBe(true)
    expect(isLivePosition({ shares: 0n })).toBe(false)
  })

  it('excludes a wallet whose position holds 0 shares', () => {
    const [e] = aggregateAttestations([
      A('0xluda', KNOWLEDGE_BUCKET_ID, [P(WALLET_A), P(WALLET_B, 0n)]),
    ])
    expect(e.distinctAttesters).toBe(1)
    expect(e.attesters).toEqual([WALLET_A])
    expect(e.attesterStakes).toEqual([{ wallet: WALLET_A, shares: STAKE }])
    expect(e.positionCount).toBe(1)
  })

  it('yields NO entry when every position on the pair holds 0 shares (indexer kept the redeemed rows)', () => {
    expect(aggregateAttestations([
      A('0xluda', KNOWLEDGE_BUCKET_ID, [P(WALLET_A, 0n), P(WALLET_B, 0n)]),
    ])).toEqual([])
  })

  it('includes a wallet that redeemed then re-bought — the 0-share row neither adds nor removes it', () => {
    for (const positions of [[P(WALLET_A, 0n), P(WALLET_A)], [P(WALLET_A), P(WALLET_A, 0n)]]) {
      const [e] = aggregateAttestations([A('0xluda', KNOWLEDGE_BUCKET_ID, positions)])
      expect(e.distinctAttesters).toBe(1)
      expect(e.attesterStakes).toEqual([{ wallet: WALLET_A, shares: STAKE }])
      expect(e.positionCount).toBe(1)
    }
    // Re-bought on a second triple for the same pair after selling out of the first.
    const [e] = aggregateAttestations([
      { ...A('0xluda', KNOWLEDGE_BUCKET_ID, [P(WALLET_A, 0n)]), tripleId: 't1' },
      { ...A('0xluda', KNOWLEDGE_BUCKET_ID, [P(WALLET_A, 3n * STAKE)]), tripleId: 't2' },
    ])
    expect(e.distinctAttesters).toBe(1)
    expect(e.totalStake).toBe(3n * STAKE)
  })

  // A sold-out row holds 0 shares, so by construction it can't move the tTRUST sum. The assertion
  // that can fail is the score: a sold-out wallet must not add an attester's weight.
  it('tTRUST attested sums only live positions; the score ignores sold-out wallets', () => {
    const [e] = aggregateAttestations([
      A('0xluda', KNOWLEDGE_BUCKET_ID, [P(WALLET_A, 2n * STAKE), P(WALLET_B, 0n)], [P(WALLET_B, 0n), P(WALLET_A, STAKE)]),
    ])
    expect(e.totalStake).toBe(2n * STAKE)
    expect(e.opposeStake).toBe(STAKE)
    // 1 attester, not 2: a sold-out wallet must not buy the +10 independence weight.
    expect(e.score).toBe(scoreAttestation(1, 2n * STAKE))
  })
})

describe('fetchAttestations — raw 0-share rows from the indexer never become attesters', () => {
  afterEach(() => vi.unstubAllGlobals())

  // Captain Dackie's live attestation triple (testnet 2026-09-26) plus a sold-out wallet row
  // shaped exactly like the indexer returns it (shares "0"): the fetch path must end with the
  // sold-out row not counted, whatever the indexer returns alongside the live one.
  const DACKIE = '0x45078ae569def2264355f77e592028dd6f1f5d6373c204fe82bf3141ab1861fb'
  const DACKIE_TRIPLE = '0xe8565630aee28d221ca6e33461ca76faaa2e20e8865b0e9be2fbd8875186f906'
  const DACKIE_COUNTER = '0x2fa8f846b504ad6e3bd24f2282c53bb194eb667354bacbd6cf054686ac19823f'
  const LIVE_ATTESTER = '0x139219107C1eBE569f543C581b3B807Cf6740006'

  const dackieTriple = { term_id: DACKIE_TRIPLE, counter_term_id: DACKIE_COUNTER, subject: { term_id: DACKIE, label: 'Captain Dackie' }, object: { term_id: CRYPTO_BUCKET_ID } }
  const fakeAttestations = (positions: unknown[], fail?: Parameters<typeof installFakeHasura>[0]['fail']) => installFakeHasura({
    tables: [
      { match: (q) => q.includes('GetAttestationTriple'), field: 'triples', rows: [dackieTriple] },
      { match: (q) => q.includes('VaultPositions'), field: 'positions', rows: positions },
    ],
    fail,
  })

  it('Dackie stays at 1 attester / 0.0099 tTRUST with a 0-share row on the same vault', async () => {
    fakeAttestations([
      { term_id: DACKIE_TRIPLE, account_id: LIVE_ATTESTER, shares: '9900000000000000' },
      { term_id: DACKIE_TRIPLE, account_id: WALLET_B, shares: '0' },
      { term_id: DACKIE_COUNTER, account_id: WALLET_A, shares: '0' },
    ])
    const res = await fetchAttestations({ subjectId: DACKIE })
    expect(res).toHaveLength(1)
    expect(res[0].distinctAttesters).toBe(1)
    expect(res[0].attesters).toEqual([LIVE_ATTESTER])
    expect(res[0].totalStake).toBe(9_900_000_000_000_000n)
    expect(res[0].opposeStake).toBe(0n)
  })

  it('130 positions on one triple (endpoint caps positions at 100 per request) → all 130 attesters counted', async () => {
    const wallets = Array.from({ length: 130 }, (_, i) => `0x${(i + 1).toString(16).padStart(40, '0')}`)
    const fake = fakeAttestations(wallets.map((w) => ({ term_id: DACKIE_TRIPLE, account_id: w, shares: String(STAKE) })))
    const [e] = await fetchAttestations({ subjectId: DACKIE })
    expect(e.distinctAttesters).toBe(130)
    expect(e.totalStake).toBe(130n * STAKE)
    expect(fake.rowCalls('positions').map((c) => c.variables.offset)).toEqual([0, 100])
  })

  it('a positions page failing mid-way → no entry at all, never a count of the first 100', async () => {
    const wallets = Array.from({ length: 130 }, (_, i) => `0x${(i + 1).toString(16).padStart(40, '0')}`)
    fakeAttestations(
      wallets.map((w) => ({ term_id: DACKIE_TRIPLE, account_id: w, shares: String(STAKE) })),
      (q, v) => (q.includes('VaultPositions(') && v.offset === 100 ? 'throw' : undefined),
    )
    expect(await fetchAttestations({ subjectId: DACKIE })).toEqual([])
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
