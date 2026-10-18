/**
 * Etap 7 — the trust gate. One decision function over what already exists: distinct live
 * attesters per area (summarizeAttesters), the agent tier (calculateAgentTier) and the data's
 * age. Fails closed: a failed read is `unknown`, never `allow`. The policy is the caller's.
 */
import { describe, it, expect } from 'vitest'
import {
  decideTrustGate, parseGatePolicy, tTrustString, DEFAULT_GATE_POLICY, GATE_AREAS,
  GATE_NOT_FOUND, GATE_LOOKUP_UNREAD, GATE_VOUCHES_UNREAD, type GatePolicy, type GateSubject,
} from '../trust-gate'
import { aggregateAttestations, type RawAttestation } from '../attestation-reader'
import { CANONICAL_DOMAINS_REGISTRY } from '../canonical-domains'

const META = { dataAgeSeconds: 42, dataReadAt: '2026-10-18T14:42:17.105Z' }
const termOf = (label: string) => CANONICAL_DOMAINS_REGISTRY.find((d) => d.label === label)!.termId
const W = (i: number) => `0x${String(i).padStart(40, '0')}`
const tt = (x: number) => BigInt(Math.round(x * 1e6)) * 1_000_000_000_000n // tTRUST → wei, exact to 1e-6

/** One attestation triple (agent, area) with these support positions, through the real aggregation. */
const raw = (agent: string, area: string, support: Array<[string, bigint]>): RawAttestation => ({
  tripleId: `${agent}-${area}`, agentId: agent, agentName: agent, domainTermId: termOf(area),
  supportPositions: support.map(([wallet, shares]) => ({ wallet, shares })), opposePositions: [],
})
const found = (...r: RawAttestation[]): GateSubject => ({ status: 'found', attested: aggregateAttestations(r) })

// Live-shaped fixtures (production /api/v1/agents/page, 2026-10-18 14:42 UTC).
const KRYPTO = '0x139219107C1eBE569f543C581b3B807Cf6740006'
const CCA0 = '0xCCA0592b0bf23C10aFc58f65d28eE8C0E78aA21C'
const LUDA = found(
  raw('Luda', 'Knowledge / Productivity', [[KRYPTO, 30_690_000_000_000_000n]]),
  raw('Luda', 'AI / Coding', [[KRYPTO, 9_900_000_000_000_000n]]),
  raw('Luda', 'Social', [[CCA0, 4_950_000_000_000_000n]]),
)
const DACKIE = found(raw('Captain Dackie', 'Crypto / Onchain', [[KRYPTO, 9_900_000_000_000_000n]]))
const OPEN_CLAW: GateSubject = { status: 'found', attested: [] }

const gate = (s: GateSubject, p: GatePolicy) => decideTrustGate(s, p, META)
const policy = (input: Parameters<typeof parseGatePolicy>[0]) => {
  const r = parseGatePolicy(input)
  if (!r.ok) throw new Error(r.error)
  return r.policy
}

describe('the reference agents (live-shaped)', () => {
  it('Luda: 2 people, 0.04554 tTRUST → Unverified → deny under the default; allow at minPeople 1 in Knowledge / Productivity', () => {
    const d = gate(LUDA, DEFAULT_GATE_POLICY)
    expect(d).toMatchObject({ decision: 'deny', tier: 'unverified', peopleVouching: 2 })
    expect(d.reason).toBe('Unverified: 2 people vouch for this agent; your minimum is Trusted (at least 2 people and 0.05 tTRUST vouched).')
    expect(d.areas).toEqual([
      { area: 'Knowledge / Productivity', people: 1, tTrust: '0.03069' },
      { area: 'AI / Coding', people: 1, tTrust: '0.0099' },
      { area: 'Social', people: 1, tTrust: '0.00495' },
    ])
    expect(gate(LUDA, { minPeople: 1, area: 'Knowledge / Productivity' })).toMatchObject({ decision: 'allow', peopleVouching: 1 })
    expect(gate(LUDA, { minPeople: 1, area: 'Crypto / Onchain' })).toMatchObject({ decision: 'deny', peopleVouching: 0 })
    expect(gate(LUDA, { minPeople: 2 })).toMatchObject({ decision: 'allow', peopleVouching: 2 }) // all areas
  })

  it('Captain Dackie: 1 person in Crypto / Onchain → deny under the default; allow at minPeople 1 in that area', () => {
    expect(gate(DACKIE, DEFAULT_GATE_POLICY)).toMatchObject({ decision: 'deny', tier: 'unverified', peopleVouching: 1 })
    const d = gate(DACKIE, { minPeople: 1, area: 'Crypto / Onchain' })
    expect(d).toMatchObject({ decision: 'allow', tier: 'unverified', peopleVouching: 1, areas: [{ area: 'Crypto / Onchain', people: 1, tTrust: '0.0099' }] })
    expect(d.reason).toBe('1 person vouches for this agent in Crypto / Onchain; your policy needs at least 1.')
  })

  it('OPEN CLAW: nobody vouches (backing is not vouching) → deny under every policy, areas []', () => {
    for (const p of [DEFAULT_GATE_POLICY, { minPeople: 1 }, { minPeople: 1, area: 'Crypto / Onchain' }] as GatePolicy[]) {
      expect(gate(OPEN_CLAW, p)).toMatchObject({ decision: 'deny', tier: 'unverified', peopleVouching: 0, areas: [] })
    }
    expect(gate(OPEN_CLAW, { minPeople: 1, area: 'Crypto / Onchain' }).reason)
      .toBe('No one vouches for this agent in Crypto / Onchain; your policy needs at least 1.')
    expect(gate(OPEN_CLAW, DEFAULT_GATE_POLICY).reason)
      .toBe('Unverified: no one vouches for this agent; your minimum is Trusted (at least 2 people and 0.05 tTRUST vouched).')
  })
})

describe('minTier — allow and deny at each rung (the thesis ladder, unchanged)', () => {
  // n people sharing `total` exactly (the first holds the remainder wei).
  const people = (n: number, total: number) => {
    const each = tt(total) / BigInt(n)
    const rem = tt(total) - each * BigInt(n)
    return found(raw('A', 'Crypto / Onchain', Array.from({ length: n }, (_, i): [string, bigint] => [W(i + 1), each + (i === 0 ? rem : 0n)])))
  }

  it.each([
    // n, tTRUST, tier, under trusted, under verified
    [1, 1.0, 'unverified', 'deny', 'deny'],
    [2, 0.049, 'unverified', 'deny', 'deny'],
    [2, 0.05, 'trusted', 'allow', 'deny'],
    [3, 0.099, 'trusted', 'allow', 'deny'],
    [3, 0.1, 'verified', 'allow', 'allow'],
  ] as const)('%i people, %f tTRUST → %s (trusted: %s, verified: %s)', (n, total, tier, t, v) => {
    expect(gate(people(n, total), { minTier: 'trusted' })).toMatchObject({ decision: t, tier, peopleVouching: n })
    expect(gate(people(n, total), { minTier: 'verified' })).toMatchObject({ decision: v, tier })
  })

  it('the allow reason names the tier and the minimum', () => {
    expect(gate(people(3, 0.1), { minTier: 'trusted' }).reason).toBe('Verified: 3 people vouch for this agent, which meets your minimum of Trusted.')
    expect(gate(people(2, 0.05), { minTier: 'verified' }).reason)
      .toBe('Trusted: 2 people vouch for this agent; your minimum is Verified (at least 3 people and 0.1 tTRUST vouched).')
  })
})

describe('minPeople — the threshold, with and without an area', () => {
  const two = found(
    raw('A', 'Crypto / Onchain', [[W(1), tt(0.01)], [W(2), tt(0.01)]]),
    raw('A', 'Social', [[W(1), tt(0.01)], [W(3), tt(0.01)]]),
  )
  it('without an area: distinct people across all areas (a wallet in two areas is one person)', () => {
    expect(gate(two, { minPeople: 3 })).toMatchObject({ decision: 'allow', peopleVouching: 3 })
    expect(gate(two, { minPeople: 4 })).toMatchObject({ decision: 'deny', peopleVouching: 3 })
  })
  it('with an area: only that area counts — exactly at the threshold allows, one below denies', () => {
    expect(gate(two, { minPeople: 2, area: 'Crypto / Onchain' })).toMatchObject({ decision: 'allow', peopleVouching: 2 })
    expect(gate(two, { minPeople: 3, area: 'Crypto / Onchain' })).toMatchObject({ decision: 'deny', peopleVouching: 2 })
    expect(gate(two, { minPeople: 1, area: 'AI / Coding' })).toMatchObject({ decision: 'deny', peopleVouching: 0 })
  })
  it('areas are sorted by people, then tTRUST', () => {
    const d = gate(found(
      raw('A', 'Social', [[W(1), tt(0.5)]]),
      raw('A', 'AI / Coding', [[W(1), tt(0.01)], [W(2), tt(0.01)]]),
      raw('A', 'Entertainment', [[W(3), tt(0.9)]]),
    ), { minPeople: 1 })
    expect(d.areas?.map((a) => a.area)).toEqual(['AI / Coding', 'Entertainment', 'Social'])
  })
})

describe('0-share wallets never count (a fully-redeemed position is not an attestation)', () => {
  it('sold-out wallets add no people, in an area or in the tier', () => {
    const s = found(raw('A', 'Crypto / Onchain', [[W(1), tt(0.03)], [W(2), 0n], [W(3), 0n], [W(4), 0n]]))
    expect(gate(s, { minPeople: 2, area: 'Crypto / Onchain' })).toMatchObject({ decision: 'deny', peopleVouching: 1 })
    expect(gate(s, { minTier: 'trusted' })).toMatchObject({ decision: 'deny', tier: 'unverified', peopleVouching: 1 })
  })
  it('an area where everyone sold out is not listed', () => {
    const s = found(raw('A', 'Social', [[W(1), 0n]]), raw('A', 'Crypto / Onchain', [[W(2), tt(0.01)]]))
    expect(gate(s, { minPeople: 1 }).areas).toEqual([{ area: 'Crypto / Onchain', people: 1, tTrust: '0.01' }])
    expect(gate(s, { minPeople: 1, area: 'Social' })).toMatchObject({ decision: 'deny', peopleVouching: 0 })
  })
  it('even an entry that still lists a 0-share wallet (not from the aggregator) adds no area and no person', () => {
    const [live] = aggregateAttestations([raw('A', 'Crypto / Onchain', [[W(2), tt(0.01)]])])
    const soldOut = { ...live, domain: CANONICAL_DOMAINS_REGISTRY.find((d) => d.label === 'Social')!, attesters: [W(1)], attesterStakes: [{ wallet: W(1), shares: 0n }], distinctAttesters: 1, totalStake: 0n }
    const d = gate({ status: 'found', attested: [live, soldOut] }, { minPeople: 1 })
    expect(d.areas).toEqual([{ area: 'Crypto / Onchain', people: 1, tTrust: '0.01' }])
    expect(gate({ status: 'found', attested: [live, soldOut] }, { minPeople: 1, area: 'Social' })).toMatchObject({ decision: 'deny', peopleVouching: 0 })
  })
})

describe('fail closed', () => {
  it('a failed attestation read → unknown under every policy, nothing claimed', () => {
    for (const p of [DEFAULT_GATE_POLICY, { minTier: 'verified' }, { minPeople: 1 }, { minPeople: 1, area: 'Social' }] as GatePolicy[]) {
      const d = gate({ status: 'found', attested: null }, p)
      expect(d).toEqual({ decision: 'unknown', reason: GATE_VOUCHES_UNREAD, tier: null, peopleVouching: null, areas: null, policy: p, meta: META })
    }
  })
  it('a failed lookup → unknown (never "not found", never allow)', () => {
    expect(gate({ status: 'unread' }, DEFAULT_GATE_POLICY)).toMatchObject({ decision: 'unknown', reason: GATE_LOOKUP_UNREAD, tier: null, peopleVouching: null })
  })
  it('unknown says not to pay', () => {
    expect(GATE_LOOKUP_UNREAD).toMatch(/do not pay/)
    expect(GATE_VOUCHES_UNREAD).toMatch(/do not pay/)
  })
  it('an id no reader knows → deny with the plain reason', () => {
    expect(gate({ status: 'not-found' }, DEFAULT_GATE_POLICY)).toMatchObject({ decision: 'deny', reason: GATE_NOT_FOUND, tier: null })
    expect(GATE_NOT_FOUND).toBe('Not found in AgentScore or the ERC-8004 registry')
  })
  it('the data age is carried through as read', () => {
    expect(gate(DACKIE, DEFAULT_GATE_POLICY).meta).toBe(META)
    expect(gate({ status: 'not-found' }, DEFAULT_GATE_POLICY).meta).toBe(META)
  })
})

describe('parseGatePolicy — the caller\'s policy, or a refusal (never a silent deny)', () => {
  it('nothing given → the default (Trusted or above)', () => {
    expect(policy({})).toEqual({ minTier: 'trusted' })
    expect(DEFAULT_GATE_POLICY).toEqual({ minTier: 'trusted' })
  })
  it('minTier trusted / verified', () => {
    expect(policy({ minTier: 'verified' })).toEqual({ minTier: 'verified' })
    expect(policy({ minTier: 'trusted' })).toEqual({ minTier: 'trusted' })
  })
  it('minPeople from a query string or a number; an area matched to its canonical name', () => {
    expect(policy({ minPeople: '1', area: 'Crypto / Onchain' })).toEqual({ minPeople: 1, area: 'Crypto / Onchain' })
    expect(policy({ minPeople: 2 })).toEqual({ minPeople: 2 })
    expect(policy({ minPeople: ' 3 ', area: ' crypto / onchain ' })).toEqual({ minPeople: 3, area: 'Crypto / Onchain' })
  })
  it.each([
    [{ minTier: 'unverified' }, /minTier must be/],
    [{ minTier: 'Trusted!' }, /minTier must be/],
    [{ minTier: 'trusted', minPeople: '1' }, /not both/],
    [{ minPeople: '0' }, /whole number, 1 or more/],
    [{ minPeople: '-1' }, /whole number/],
    [{ minPeople: '1.5' }, /whole number/],
    [{ minPeople: 1.5 }, /whole number/],
    [{ minPeople: 'one' }, /whole number/],
    [{ minPeople: '1e1' }, /whole number/],
    [{ minPeople: '0x1' }, /whole number/],
    [{ area: 'Social' }, /area goes with minPeople/],
    [{ minPeople: '1', area: 'Crypto' }, /Unknown area "Crypto"/],
    [{ minPeople: '1', area: 7 }, /Unknown area/],
  ] as const)('%j → refused', (input, error) => {
    const r = parseGatePolicy(input)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(error)
  })
  it('an unknown area lists the real ones', () => {
    const r = parseGatePolicy({ minPeople: '1', area: 'Finance' })
    expect(!r.ok && r.error).toContain(GATE_AREAS.join(', '))
    expect(GATE_AREAS).toContain('Crypto / Onchain')
    expect(GATE_AREAS).toHaveLength(8)
  })
})

describe('tTrustString — exact, from wei', () => {
  it.each([
    [0n, '0'], [1_000_000_000_000_000_000n, '1'], [9_900_000_000_000_000n, '0.0099'],
    [50_000_000_000_000_000n, '0.05'], [1n, '0.000000000000000001'], [-5_000_000_000_000_000n, '-0.005'],
  ])('%s → %s', (wei, s) => expect(tTrustString(wei)).toBe(s))
})

describe('no new scoring, nothing for sale', () => {
  it('the module reads only the existing derivations and takes no input beyond subject, policy and age', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync(new URL('../trust-gate.ts', import.meta.url), 'utf8')
    expect(src).toMatch(/import \{ summarizeAttesters \} from '\.\/agent-profile'/)
    expect(src).toMatch(/calculateAgentTier/)
    expect(src).not.toMatch(/fetch\(|process\.env|headers/)
    expect(decideTrustGate.length).toBe(3)
  })
})
