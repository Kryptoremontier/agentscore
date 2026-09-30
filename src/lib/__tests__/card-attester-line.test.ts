import { describe, it, expect, afterEach } from 'vitest'
import { vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { installFakeHasura } from './fake-hasura'
import { CardAttesterLine as CardAttesterLineView } from '../../components/agents/CardAttesterLine'
import { fetchAttestationsForSubjects, type AttestedEntry } from '../attestation-reader'
import { fetchAgentProfileVector, computeModalStatSummary, summarizeAttesters } from '../agent-profile'
import { calculateAgentTier } from '../agent-tier'
import {
  cardAttestationView, cardAttesterLine, attesterLineOf, tierChipOf, isCompactCard, CARD_NO_ATTESTATIONS,
  type CardAttesterLine, type CardAttestationView,
} from '../agent-list'

/**
 * The /agents card's attester line (commit 5). The list reads attestations in
 * bulk (fetchAttestationsForSubjects), the modal per agent (fetchAgentProfileVector);
 * both go through summarizeAttesters, so they must print the same numbers.
 *
 * Rows are the live testnet attestations on 2026-09-26 (the only two canonical
 * attestation triples with a position): Captain Dackie → Crypto / Onchain, 1 wallet,
 * 0.0099 tTRUST; Luda → Knowledge / Productivity, the same wallet, 0.02079 tTRUST.
 * OPEN CLAW has no attestation triple. The 0-share row on Dackie's triple is INJECTED
 * (live has no 0-share row on an attestation triple): it proves a sold-out wallet changes nothing.
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
  // Injected, not live: a wallet that sold out of Dackie's triple (a raw 0-share row), not an attester.
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
    [DACKIE]: { attesters: 1, domains: 1, tier: 'unverified', claim: '1 person vouches · for Crypto / Onchain' },
    [LUDA]: { attesters: 1, domains: 1, tier: 'unverified', claim: '1 person vouches · for Knowledge / Productivity' },
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
  it('the card shows "1 person vouches", never "Nobody vouches yet" (a sold-out wallet on the same triple changes nothing)', async () => {
    fake()
    const line = cardAttesterLine(cardAttestationView((await fetchAttestationsForSubjects([DACKIE])).get(DACKIE)!))
    expect(line.kind).toBe('some')
    expect(line.claim).toBe('1 person vouches · for Crypto / Onchain')
    expect(line.claim).not.toContain(CARD_NO_ATTESTATIONS)
  })

  it('a failed read → no claim (CTA only), never "Nobody vouches yet"', async () => {
    fake((q) => (q.includes('VaultPositions(') ? 'throw' : undefined))
    const view = await fetchAttestationsForSubjects([DACKIE]).then((m) => cardAttestationView(m.get(DACKIE)!), () => null)
    expect(view).toBeNull()
    expect(cardAttesterLine(view)).toEqual({ kind: 'unread', claim: null, cta: true })
  })

  it('its card keeps one shape across the read: compact before and after (it used to grow 82 → 137 px when the read answered)', () => {
    // A cohort row: the list never reads its atom vault. The shape is decided at first paint.
    expect(isCompactCard({ vaultRead: false })).toBe(true)
    // Only the line changes — loading → "1 person vouches · for Crypto / Onchain" — inside its reserved height.
    expect(attesterLineOf(undefined, DACKIE).kind).toBe('loading')
    const after = new Map([[DACKIE, { attesters: 1, domains: 1, areas: ['Crypto / Onchain'], stakeWei: 0n, tier: calculateAgentTier([]) }]])
    expect(attesterLineOf(after, DACKIE).claim).toBe('1 person vouches · for Crypto / Onchain')
  })

  it('OPEN CLAW (AgentScore row, vault read, 0 attesters) keeps the full card with "Nobody vouches yet · Vouch"', async () => {
    fake()
    const line = cardAttesterLine(cardAttestationView((await fetchAttestationsForSubjects([OPEN_CLAW])).get(OPEN_CLAW)!))
    expect(line).toEqual({ kind: 'none', claim: CARD_NO_ATTESTATIONS, cta: true })
    expect(isCompactCard({ vaultRead: true })).toBe(false)
  })
})

describe('cardAttesterLine — states (REPO_MAP §7 rule 5: failed ≠ empty)', () => {
  const entry = (domain: string, wallets: Array<[string, bigint]>) => ({
    domain: { label: domain }, attesterStakes: wallets.map(([wallet, shares]) => ({ wallet, shares })),
    totalStake: wallets.reduce((sum, [, shares]) => sum + shares, 0n),
  }) as unknown as AttestedEntry

  it('not read yet → no text claim at all (a skeleton holds the line), no CTA', () => {
    expect(cardAttesterLine(undefined)).toEqual({ kind: 'loading', claim: null, cta: false })
  })
  it('read failed → no claim, CTA only', () => {
    expect(cardAttesterLine(null)).toEqual({ kind: 'unread', claim: null, cta: true })
  })
  it('read ok, no attestation → "Nobody vouches yet" + CTA', () => {
    expect(cardAttesterLine(cardAttestationView([]))).toEqual({ kind: 'none', claim: 'Nobody vouches yet', cta: true })
  })
  it('plurals and cross-domain dedup: one wallet on two domains + another on one → "2 people vouch · for 2 areas"', () => {
    const view = cardAttestationView([entry('Crypto / Onchain', [['0xA', 5n], ['0xB', 1n]]), entry('Social', [['0xa', 3n]])])
    expect(cardAttesterLine(view).claim).toBe('2 people vouch · for 2 areas')
  })
  it('one area is named; one person is singular', () => {
    const view = cardAttestationView([entry('Knowledge / Productivity', [['0xA', 5n]])])
    expect(cardAttesterLine(view).claim).toBe('1 person vouches · for Knowledge / Productivity')
    expect(cardAttesterLine(cardAttestationView([entry('Social', [['0xA', 5n], ['0xB', 1n]])])).claim).toBe('2 people vouch · for Social')
  })
})

describe('isCompactCard — only rows whose vault the list never read, decided at first paint', () => {
  it('cohort row (vault not read) → compact; AgentScore row (its stake line is a measurement) → full', () => {
    expect(isCompactCard({ vaultRead: false })).toBe(true)
    expect(isCompactCard({ vaultRead: true })).toBe(false)
  })
  it('the attestation read cannot reshape a card: the rule takes no attestation input', () => {
    expect(isCompactCard.length).toBe(1)
    // @ts-expect-error — the attester line is not an input any more
    expect(isCompactCard({ vaultRead: false, line: cardAttesterLine({ attesters: 1, domains: 1, areas: ['Social'], stakeWei: 0n, tier: calculateAgentTier([]) }) })).toBe(true)
  })
})

// ─── Grid ↔ list parity (Etap 4b-finish commit 4) ────────────────────────────

const PAGE = readFileSync(path.join(__dirname, '../../app/agents/page.tsx'), 'utf8')
const GRID_VIEW = PAGE.slice(PAGE.indexOf('/* ── GRID VIEW ── */'), PAGE.indexOf('/* ── LIST VIEW ──'))
const LIST_VIEW = PAGE.slice(PAGE.indexOf('/* ── LIST VIEW ──'), PAGE.indexOf('{/* Agent Detail Modal */}'))

/** What a row prints for its attester line: the component's text, tags stripped. */
function printed(line: CardAttesterLine): string {
  return renderToStaticMarkup(createElement(CardAttesterLineView, { line, agentName: 'x', onAttest: () => {} }))
    .replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'").replace(/&amp;/g, '&')
}

describe('grid ↔ list parity — Dackie, Luda, OPEN CLAW (live rows 2026-09-26)', () => {
  it('both views derive the line with the one helper and render it with the one component', () => {
    for (const view of [GRID_VIEW, LIST_VIEW]) {
      expect(view.match(/attesterLineOf\(attestationViewBySubject, agent\.term_id\)/g)).toHaveLength(1)
      expect(view.match(/tierChipOf\(attestationViewBySubject, agent\.term_id\)/g)).toHaveLength(1)
      expect(view).toMatch(/<CardAttesterLine line=\{attesterLine\}/)
      expect(view).toMatch(/<OriginChip origin=\{agent\.origin\} tab=\{originFilter\} \/>/)
    }
    // No second derivation anywhere on the page.
    expect(PAGE).not.toMatch(/cardAttesterLine\(|cardViewFor\(/)
  })

  it('the line each of the three prints, from the bulk read the page makes', async () => {
    fake()
    const bulk = await fetchAttestationsForSubjects([DACKIE, LUDA, OPEN_CLAW])
    const views = new Map<string, CardAttestationView>([...bulk].map(([id, e]) => [id, cardAttestationView(e)]))
    expect(printed(attesterLineOf(views, DACKIE))).toBe('1 person vouches · for Crypto / Onchain')
    expect(printed(attesterLineOf(views, LUDA))).toBe('1 person vouches · for Knowledge / Productivity')
    expect(printed(attesterLineOf(views, OPEN_CLAW))).toBe('Nobody vouches yet · Vouch')
    for (const id of [DACKIE, LUDA, OPEN_CLAW]) expect(tierChipOf(views, id)).toBeNull() // all Unverified
  })

  it('list names wrap — never truncated to one character on a phone', () => {
    expect(LIST_VIEW).toMatch(/\[overflow-wrap:anywhere\]">\{name\}/)
    expect(LIST_VIEW).not.toMatch(/truncate">\{name\}/)
    // The fixed w-20/w-16/w-12 columns + gap-4 + px-4 left the name ~38 px at 390 px: phones drop the stake columns.
    expect(PAGE).toMatch(/const LIST_ROW_GRID = 'grid grid-cols-\[2rem_minmax\(0,1fr\)_3rem\] sm:/)
  })
})

describe('the attester line keeps its height while loading (no layout shift, no text claim)', () => {
  it('loading: no text, a skeleton bar shorter than the line; every state: the same 18 px line box', () => {
    const states: CardAttesterLine[] = [
      cardAttesterLine(undefined), cardAttesterLine(null), cardAttesterLine(cardAttestationView([])),
      cardAttesterLine({ attesters: 3, domains: 2, areas: ['Social', 'Energy'], stakeWei: 0n, tier: calculateAgentTier([]) }),
    ]
    const html = states.map((line) => renderToStaticMarkup(createElement(CardAttesterLineView, { line, agentName: 'x', onAttest: () => {} })))
    expect(printed(states[0])).toBe('')
    expect(html[0]).toMatch(/<span aria-hidden="true" class="inline-block align-middle h-2\.5 [^"]*animate-pulse"><\/span>/)
    const box = (h: string) => h.match(/^<p class="([^"]*)"/)![1]
    for (const h of html) expect(box(h)).toBe(box(html[0]))
    expect(box(html[0])).toMatch(/\bleading-\[18px\] min-h-\[18px\]/)
  })
})
