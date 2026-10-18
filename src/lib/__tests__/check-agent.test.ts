/**
 * Etap 7 Run B — "Check an agent": one box, any agent. The lookups read only what the /agents
 * answer holds (both corpora, the attestations, each part's age) and the cohort's identity links;
 * a name that fits more than one agent is a pick list, never a guess; a failed read is "couldn't
 * read", never "not found". Fixtures shaped like testnet 2026-10-18.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseCheckQuery, resolveCheckQuery, checkCardOf, CHECK_PICK_MAX, type CheckQuery } from '../check-agent'
import { aggregateAttestations, type AttestedEntry } from '../attestation-reader'
import { CANONICAL_DOMAINS_REGISTRY } from '../canonical-domains'
import type { AgentsPagePayload, AgentsPageView, PagePart } from '../agents-page-types'
import type { AgentListAtom } from '../agent-list'

const LUDA = '0x82d87d9517b68e653418c0e49805b36aca3e33a00536af25fc319f5c24802c5a'
const OPEN_CLAW = '0x0d579846f21a66f35efafb2339d182e27560ec9f9d8ea64f7f1d9929d20a2d7d'
const DACKIE = '0x45078ae569def2264355f77e592028dd6f1f5d6373c204fe82bf3141ab1861fb'
const ANCN_1 = `0x${'a1'.repeat(32)}`
const ANCN_2 = `0x${'a2'.repeat(32)}`
const GEKKO = Array.from({ length: 10 }, (_, i) => `0x${String(i).padStart(2, '0').repeat(32)}`)
const KRYPTO = '0x139219107C1eBE569f543C581b3B807Cf6740006'
const CCA0 = '0xCCA0592b0bf23C10aFc58f65d28eE8C0E78aA21C'
const LUDA_OWNER = '0xCbdE65F69574C94f0c3Ba7927E3D5Eb7d921FfEd'
const CAIP_DACKIE = 'eip155:8453/erc721:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432/1380'
const NOW = Date.parse('2026-10-18T18:00:00Z')

const term = (label: string) => CANONICAL_DOMAINS_REGISTRY.find((d) => d.label === label)!.termId
const attest = (agent: string, rows: Array<[string, string, bigint]>): AttestedEntry[] => aggregateAttestations(rows.map(([area, wallet, shares], i) => ({
  tripleId: `${agent}-${i}`, agentId: agent, agentName: agent, domainTermId: term(area),
  supportPositions: [{ wallet, shares }], opposePositions: [],
})))

const row = (term_id: string, label: string, shares: string, created_at: string, positions: AgentListAtom['__vaultPositions'] = []): AgentListAtom => ({
  term_id, label, data: null, type: 'Thing', created_at,
  positions_aggregate: { aggregate: { sum: { shares } } }, __vaultPositions: positions,
})
const LUDA_ROW = row(LUDA, '{"name":"Luda"}', '980000000000000', '2026-06-01T07:58:48+00:00', [
  { id: 'p1', term_id: LUDA, account_id: LUDA_OWNER, shares: '980000000000000', created_at: '2026-06-01T07:58:48+00:00', updated_at: '', account: { label: 'ludarep.eth' } } as never,
])
const OC_ROW = row(OPEN_CLAW, 'Agent: OPEN CLAW from Kryptoremontier - OPEN CLAW from Kryptoremontier for Testing AgentScore.', '335060865858275579', '2026-02-18T15:47:00+00:00')

function view(opts: { attestations?: boolean; corpusTruncated?: boolean | null; cohortFailed?: boolean } = {}): AgentsPageView {
  const att = new Map<string, AttestedEntry[]>([
    [LUDA, attest(LUDA, [['Knowledge / Productivity', KRYPTO, 30_690_000_000_000_000n], ['AI / Coding', KRYPTO, 9_900_000_000_000_000n], ['Social', CCA0, 4_950_000_000_000_000n]])],
    [OPEN_CLAW, []],
    [DACKIE, attest(DACKIE, [['Crypto / Onchain', KRYPTO, 9_900_000_000_000_000n]])],
    [ANCN_1, []], [ANCN_2, []], ...GEKKO.map((g) => [g, []] as [string, AttestedEntry[]]),
  ])
  return {
    agentScore: { status: 'ok', rows: [LUDA_ROW, OC_ROW], junk: 6, fetched: 15, total: 15, truncated: opts.corpusTruncated === undefined ? false : opts.corpusTruncated },
    cohort: opts.cohortFailed ? { status: 'error' } : {
      status: 'ok', total: 13, truncated: false,
      agents: [
        { termId: DACKIE, label: 'Captain Dackie', createdAt: '2026-05-08T14:11:19+00:00' },
        { termId: ANCN_1, label: 'AncnBot', createdAt: '2026-07-01T00:00:00Z' },
        { termId: ANCN_2, label: 'AncnBot', createdAt: '2026-07-02T00:00:00Z' },
        ...GEKKO.map((g, i) => ({ termId: g, label: `Gekko ${['Allocator', 'Executor', 'Rebalancer', 'Strategist', 'A', 'B', 'C', 'D', 'E', 'F'][i]}`, createdAt: '2026-07-01T00:00:00Z' })),
      ],
    },
    attestations: opts.attestations === false ? null : att,
    parts: [],
    unreachable: false,
  }
}
const IDS = [{ termId: DACKIE, caipIdentity: CAIP_DACKIE }]
const resolve = (raw: string, v = view(), ids: typeof IDS | null = IDS) => resolveCheckQuery(parseCheckQuery(raw), v, ids)

describe('parseCheckQuery — the box takes any way a person names an agent', () => {
  it.each<[string, CheckQuery]>([
    ['', { kind: 'empty' }],
    ['   ', { kind: 'empty' }],
    [DACKIE.toUpperCase().replace('0X', '0x'), { kind: 'termId', termId: DACKIE }],
    [KRYPTO, { kind: 'wallet', wallet: KRYPTO }],
    ['8453:1380', { kind: 'erc8004', chainId: '8453', tokenId: '1380', registry: null }],
    [CAIP_DACKIE, { kind: 'erc8004', chainId: '8453', tokenId: '1380', registry: '0x8004a169fb4a3325136eb29fa0ceb6d2e539a432' }],
    ['  Captain Dackie ', { kind: 'name', name: 'Captain Dackie' }],
    ['0x1234', { kind: 'name', name: '0x1234' }],
  ])('%j → %j', (raw, q) => expect(parseCheckQuery(raw)).toEqual(q))
})

describe('resolveCheckQuery — found, a pick list, not found, or unread', () => {
  it('a term id the list holds → found (AgentScore and ERC-8004 alike)', () => {
    expect(resolve(LUDA)).toEqual({ status: 'found', id: LUDA })
    expect(resolve(DACKIE)).toEqual({ status: 'found', id: DACKIE })
  })

  it('an ERC-8004 id → the cohort agent with that identity link (short and CAIP forms)', () => {
    expect(resolve('8453:1380')).toEqual({ status: 'found', id: DACKIE })
    expect(resolve(CAIP_DACKIE)).toEqual({ status: 'found', id: DACKIE })
    expect(resolve('8453:9999')).toMatchObject({ status: 'not-found' })
    expect(resolve('eip155:8453/erc721:0x0000000000000000000000000000000000000001/1380')).toMatchObject({ status: 'not-found' })
  })

  it('a name: exact (any case) → found; the card\'s own name (Luda from its JSON atom, OPEN CLAW cleaned)', () => {
    expect(resolve('luda')).toEqual({ status: 'found', id: LUDA })
    expect(resolve('captain dackie')).toEqual({ status: 'found', id: DACKIE })
    expect(resolve('OPEN CLAW')).toEqual({ status: 'found', id: OPEN_CLAW })
    expect(resolve('Dackie')).toEqual({ status: 'found', id: DACKIE }) // one agent contains it
  })

  it('a name that fits more than one agent → a pick list, never a guess', () => {
    const r = resolve('AncnBot')
    expect(r).toMatchObject({ status: 'choose', more: 0 })
    expect(r.status === 'choose' && r.candidates.map((c) => c.id).sort()).toEqual([ANCN_1, ANCN_2].sort())
  })

  it('a long pick list stops at CHECK_PICK_MAX and says how many more', () => {
    const r = resolve('Gekko')
    expect(r).toMatchObject({ status: 'choose', more: 10 - CHECK_PICK_MAX })
    expect(r.status === 'choose' && r.candidates).toHaveLength(CHECK_PICK_MAX)
  })

  it('names under 3 letters match only exactly (no half-registry pick lists)', () => {
    expect(resolve('a')).toMatchObject({ status: 'not-found' })
    expect(resolve('Lu')).toMatchObject({ status: 'not-found' }) // not "Luda"
  })

  it('pick-list entries carry who vouches; most vouched first', () => {
    const v = view()
    v.attestations!.set(ANCN_2, attest(ANCN_2, [['Social', CCA0, 1_000_000_000_000_000n]]))
    const r = resolveCheckQuery(parseCheckQuery('AncnBot'), v, IDS)
    expect(r.status === 'choose' && r.candidates.map((c) => [c.id, c.people])).toEqual([[ANCN_2, 1], [ANCN_1, 0]])
    v.attestations!.delete(ANCN_1)
    const unread = resolveCheckQuery(parseCheckQuery('AncnBot'), v, IDS)
    expect(unread.status === 'choose' && unread.candidates.map((c) => c.people)).toEqual([1, null]) // not read → null, never 0
  })

  it('a wallet → the agent it registered (its position opened with the atom), not one it only backs', () => {
    expect(resolve(LUDA_OWNER)).toEqual({ status: 'found', id: LUDA })
    expect(resolve(KRYPTO)).toMatchObject({ status: 'not-found', query: { kind: 'wallet' } }) // vouches, registered nothing here
  })

  it('nothing fits → not found, only when both lists were read to the end', () => {
    expect(resolve('zzzz-no-such-agent')).toMatchObject({ status: 'not-found', query: { kind: 'name' } })
    expect(resolve(`0x${'f'.repeat(64)}`)).toMatchObject({ status: 'not-found', query: { kind: 'termId' } })
  })

  it('a list that failed or stopped at a cap → unread, never "not found"', () => {
    expect(resolve('zzzz', view({ cohortFailed: true }))).toEqual({ status: 'unread' })
    expect(resolve('zzzz', view({ corpusTruncated: true }))).toEqual({ status: 'unread' })
    expect(resolve('zzzz', view({ corpusTruncated: null }))).toEqual({ status: 'unread' })
    expect(resolve('8453:1380', view(), null)).toEqual({ status: 'unread' })
    // …while what it does hold is still found.
    expect(resolve('Luda', view({ cohortFailed: true }))).toEqual({ status: 'found', id: LUDA })
  })

  it('empty box → empty', () => {
    expect(resolve('')).toEqual({ status: 'empty' })
  })
})

describe('checkCardOf — the /agents card\'s own derivations', () => {
  const part = (readAt: string): PagePart<unknown> => ({ status: 'ok', value: null, dataReadAt: readAt, dataAgeSeconds: 0, complete: true, staleAfterSeconds: 165 })
  const payload = {
    agentScore: part('2026-10-18T17:55:00Z'),
    cohort: part('2026-10-18T17:50:00Z'),
    cohortAttestations: part('2026-10-18T17:58:00Z'),
  } as unknown as AgentsPagePayload

  it('Luda: 2 people for 3 areas, Unverified (0.04554 < 0.05 tTRUST), backing measured, data 5 min old', () => {
    const c = checkCardOf(LUDA, payload, view(), NOW)!
    expect(c).toMatchObject({ id: LUDA, name: 'Luda', origin: 'agentscore', line: { kind: 'some', claim: '2 people vouch · for 3 areas' }, dataAgeSeconds: 300 })
    expect(c.attesters?.map((a) => a.wallet)).toEqual([KRYPTO, CCA0])
    expect(c.tier?.tier).toBe('unverified')
    expect(c.backing).toEqual(expect.any(Number))
  })

  it('Captain Dackie: ERC-8004, 1 person for Crypto / Onchain, no backing score (its vault is not read); the oldest of its two parts', () => {
    const c = checkCardOf(DACKIE, payload, view(), NOW)!
    expect(c).toMatchObject({ name: 'Captain Dackie', origin: 'erc8004', line: { claim: '1 person vouches · for Crypto / Onchain' }, backing: null, dataAgeSeconds: 600, dataReadAt: '2026-10-18T17:50:00Z' })
  })

  it('OPEN CLAW: nobody vouches (backing is not vouching)', () => {
    expect(checkCardOf(OPEN_CLAW, payload, view(), NOW)).toMatchObject({ line: { kind: 'none', claim: 'Nobody vouches yet' }, attesters: [], tier: { tier: 'unverified' } })
  })

  it('attestations unread → no claim, no seals, tier unknown — never "Nobody vouches"', () => {
    expect(checkCardOf(LUDA, payload, view({ attestations: false }), NOW)).toMatchObject({ line: { kind: 'unread', claim: null }, attesters: null, tier: null })
  })

  it('an id the list doesn\'t hold → null', () => {
    expect(checkCardOf(`0x${'f'.repeat(64)}`, payload, view(), NOW)).toBeNull()
  })
})

describe('the page', () => {
  const page = readFileSync('src/app/check/page.tsx', 'utf8')
  it('a plain GET form named q (works before JS), the answer under a fixed-height skeleton', () => {
    expect(page).toMatch(/<form action="\/check" method="get"/)
    expect(page).toMatch(/name="q"/)
    expect(page).toMatch(/<Suspense key=\{q\} fallback=\{<AnswerSkeleton \/>\}>/)
  })
  it('reads only through lib/check-data (the /agents answer and the cached cohort)', () => {
    expect(page).toMatch(/import \{ checkLookup \} from '@\/lib\/check-data'/)
    const data = readFileSync('src/lib/check-data.ts', 'utf8')
    expect(data).toMatch(/getAgentsPageData\(\)/)
    expect(data).toMatch(/loadErc8004Cohort\(\)/)
    expect(data).not.toMatch(/fetch\(|gql|graphql/i)
  })
  it('the card: SealRow lg, the tier chip with its "?", the backing score, the age, one Vouch action', () => {
    const card = readFileSync('src/components/check/CheckResultCard.tsx', 'utf8')
    expect(card).toMatch(/<SealRow attesters=\{card\.attesters\} size="lg"/)
    expect(card).toMatch(/<AgentTierChip tier=\{card\.tier\}[\s\S]*?<Explainer term="tiers" \/>/)
    expect(card).toMatch(/<BackingScore value=\{card\.backing\}/)
    expect(card).toMatch(/updatedAgoLabel\(card\.dataAgeSeconds\)/)
    expect(card.match(/<AttestButton /g)).toHaveLength(1)
  })
})
