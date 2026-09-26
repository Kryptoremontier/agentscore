import { describe, it, expect, afterEach } from 'vitest'
import { vi } from 'vitest'
import { installFakeHasura } from './fake-hasura'
import { fetchAttestationsForSubjects, type AttestedEntry } from '../attestation-reader'
import { fetchAgentProfileVector, computeModalStatSummary, summarizeAttesters } from '../agent-profile'
import { calculateAgentTier } from '../agent-tier'
import {
  cardAttestationView, cardAttesterLine, isCompactCard, CARD_NO_ATTESTATIONS, type CardAttesterLine,
} from '../agent-list'

/**
 * The /agents card's attester line (commit 5). The list reads attestations in
 * bulk (fetchAttestationsForSubjects), the modal per agent (fetchAgentProfileVector);
 * both go through summarizeAttesters, so they must print the same numbers.
 *
 * Rows are the live testnet attestations on 2026-09-26 (the only two canonical
 * attestation triples with a position): Captain Dackie → Crypto / Onchain, 1 wallet,
 * 0.0099 tTRUST; Luda → Knowledge / Productivity, the same wallet, 0.02079 tTRUST.
 * OPEN CLAW has no attestation triple.
 */

const DACKIE = '0x45078ae569def2264355f77e592028dd6f1f5d6373c204fe82bf3141ab1861fb'
const LUDA = '0x82d87d9517b68e653418c0e49805b36aca3e33a00536af25fc319f5c24802c5a'
// OPEN CLAW from Kryptoremontier — AgentScore row, vault read (measured 98), no attestation triple.
const OPEN_CLAW = '0x0d579846f21a66f35efafb2339d182e27560ec9f9d8ea64f7f1d9929d20a2d7d'
const CRYPTO = '0xecc2b1dce5f8269777d9001faa532642691d7038eed3c639f04895ac5b312d42'
const KNOWLEDGE = '0x8a0e3710014141458ee303a6cc504704ee3da370450d7f5cd5a898186a2f66e4'
const DACKIE_TRIPLE = '0xe8565630aee28d221ca6e33461ca76faaa2e20e8865b0e9be2fbd8875186f906'
const DACKIE_COUNTER = '0x2fa8f846b504ad6e3bd24f2282c53bb194eb667354bacbd6cf054686ac19823f'
const LUDA_TRIPLE = '0x54c64639c1f937890f5f67e65e9bcc708c5c6cce7cb9118c705c235c1fc94f75'
const LUDA_COUNTER = '0x23b942eef2eeb35d768dc31295fe0ff7d14dfae9a90157fe55f87579dd954833'
const ATTESTER = '0x139219107C1eBE569f543C581b3B807Cf6740006'
const SOLD_OUT = '0x5555555555555555555555555555555555555555'

const TRIPLES = [
  { term_id: DACKIE_TRIPLE, counter_term_id: DACKIE_COUNTER, subject: { term_id: DACKIE, label: 'Captain Dackie' }, object: { term_id: CRYPTO } },
  { term_id: LUDA_TRIPLE, counter_term_id: LUDA_COUNTER, subject: { term_id: LUDA, label: 'Luda' }, object: { term_id: KNOWLEDGE } },
]
const POSITIONS = [
  { id: `${DACKIE_TRIPLE}-1-${ATTESTER}`, term_id: DACKIE_TRIPLE, account_id: ATTESTER, shares: '9900000000000000' },
  // A wallet that sold out of Dackie's triple: raw row from the indexer, not an attester.
  { id: `${DACKIE_TRIPLE}-1-${SOLD_OUT}`, term_id: DACKIE_TRIPLE, account_id: SOLD_OUT, shares: '0' },
  { id: `${LUDA_TRIPLE}-1-${ATTESTER}`, term_id: LUDA_TRIPLE, account_id: ATTESTER, shares: '20790000000000000' },
]

function fake(fail?: Parameters<typeof installFakeHasura>[0]['fail']) {
  return installFakeHasura({
    tables: [
      {
        match: (q) => q.includes('GetAttestationTriple'),
        field: 'triples',
        rows: (_q, v) => TRIPLES.filter((t) => (v.subjects as string[]).includes(t.subject.term_id)),
      },
      { match: (q) => q.includes('VaultPositions'), field: 'positions', rows: (_q, v) => POSITIONS.filter((p) => (v.vaultIds as string[]).includes(p.term_id)) },
      { match: (q) => q.includes('GetAgentReport'), field: 'triples', rows: [] },
    ],
    fail,
  })
}

afterEach(() => vi.unstubAllGlobals())

/** What the modal prints for one agent: its stat row and its tier chip. */
async function modalView(id: string) {
  const { attested } = await fetchAgentProfileVector(id)
  if (!attested) throw new Error('modal attestation read failed')
  const stats = computeModalStatSummary({ attested, reportCount: 0, backerCount: 0, backerVaultWei: 0n, signals: 0 })
  return { attesters: stats.attesters, domains: stats.domains, tier: calculateAgentTier(summarizeAttesters(attested)).tier }
}

describe('list ↔ modal parity — Dackie, Luda, OPEN CLAW (live rows 2026-09-26)', () => {
  const expected = {
    [DACKIE]: { attesters: 1, domains: 1, tier: 'unverified', claim: '1 attester · 1 domain' },
    [LUDA]: { attesters: 1, domains: 1, tier: 'unverified', claim: '1 attester · 1 domain' },
    [OPEN_CLAW]: { attesters: 0, domains: 0, tier: 'unverified', claim: CARD_NO_ATTESTATIONS },
  } as const

  for (const [id, want] of Object.entries(expected)) {
    it(`${id.slice(0, 10)}…: the card and the modal print ${want.attesters} attester(s), ${want.domains} domain(s), ${want.tier}`, async () => {
      fake()
      const bulk = await fetchAttestationsForSubjects([DACKIE, LUDA, OPEN_CLAW])
      const card = cardAttestationView(bulk.get(id)!)
      const modal = await modalView(id)
      expect({ attesters: card.attesters, domains: card.domains, tier: card.tier.tier }).toEqual(modal)
      expect(modal).toEqual({ attesters: want.attesters, domains: want.domains, tier: want.tier })
      expect(cardAttesterLine(card).claim).toBe(want.claim)
    })
  }
})

describe('Captain Dackie — the first cohort attestation', () => {
  it('the card shows "1 attester", never "No attestations yet" (a sold-out wallet on the same triple changes nothing)', async () => {
    fake()
    const line = cardAttesterLine(cardAttestationView((await fetchAttestationsForSubjects([DACKIE])).get(DACKIE)!))
    expect(line.kind).toBe('some')
    expect(line.claim).toBe('1 attester · 1 domain')
    expect(line.claim).not.toContain(CARD_NO_ATTESTATIONS)
  })

  it('a failed read → no claim (CTA only), never "No attestations yet"', async () => {
    fake((q) => (q.includes('VaultPositions(') ? 'throw' : undefined))
    const view = await fetchAttestationsForSubjects([DACKIE]).then((m) => cardAttestationView(m.get(DACKIE)!), () => null)
    expect(view).toBeNull()
    expect(cardAttesterLine(view)).toEqual({ kind: 'unread', claim: null, cta: true })
  })

  it('keeps the full card (it has an attester); a cohort row with no attestation goes compact', () => {
    const dackie = cardAttesterLine({ attesters: 1, domains: 1, tier: calculateAgentTier([]) })
    expect(isCompactCard({ vaultRead: false, line: dackie })).toBe(false)
    expect(isCompactCard({ vaultRead: false, line: cardAttesterLine(cardAttestationView([])) })).toBe(true)
  })

  it('OPEN CLAW (AgentScore row, vault read, 0 attesters) keeps the full card with "No attestations yet · Attest"', async () => {
    fake()
    const line = cardAttesterLine(cardAttestationView((await fetchAttestationsForSubjects([OPEN_CLAW])).get(OPEN_CLAW)!))
    expect(line).toEqual({ kind: 'none', claim: CARD_NO_ATTESTATIONS, cta: true })
    expect(isCompactCard({ vaultRead: true, line })).toBe(false)
  })
})

describe('cardAttesterLine — states (REPO_MAP §7 rule 5: failed ≠ empty)', () => {
  const entry = (domain: string, wallets: Array<[string, bigint]>) => ({
    domain: { label: domain }, attesterStakes: wallets.map(([wallet, shares]) => ({ wallet, shares })),
  }) as unknown as AttestedEntry

  it('not read yet → "— attesters", no CTA', () => {
    expect(cardAttesterLine(undefined)).toEqual({ kind: 'loading', claim: '— attesters', cta: false })
  })
  it('read failed → no claim, CTA only', () => {
    expect(cardAttesterLine(null)).toEqual({ kind: 'unread', claim: null, cta: true })
  })
  it('read ok, no attestation → "No attestations yet" + CTA', () => {
    expect(cardAttesterLine(cardAttestationView([]))).toEqual({ kind: 'none', claim: 'No attestations yet', cta: true })
  })
  it('plurals and cross-domain dedup: one wallet on two domains + another on one → 2 attesters · 2 domains', () => {
    const view = cardAttestationView([entry('Crypto / Onchain', [['0xA', 5n], ['0xB', 1n]]), entry('Social', [['0xa', 3n]])])
    expect(cardAttesterLine(view).claim).toBe('2 attesters · 2 domains')
  })
})

describe('isCompactCard — only rows whose vault the list never read', () => {
  const lines: CardAttesterLine[] = [
    cardAttesterLine(undefined), cardAttesterLine(null), cardAttesterLine(cardAttestationView([])),
  ]
  it('cohort row (vault not read) with no known attester → compact, whatever the read state', () => {
    for (const line of lines) expect(isCompactCard({ vaultRead: false, line })).toBe(true)
  })
  it('AgentScore row (vault read, its stake line is a measurement) → always the full card', () => {
    for (const line of lines) expect(isCompactCard({ vaultRead: true, line })).toBe(false)
  })
})
