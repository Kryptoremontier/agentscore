/**
 * Etap 8b Run A — the landing tells the story in numbered sections, built from real data.
 *
 * Hero → 01 How it works → 02 Trust over time (a live card for one real agent) → 03 Agents ask first
 * (a real should_i_trust answer) → 04 Trust contexts → the closing block, then the site footer.
 * These are the source and render guards; the harness checks the phone first screen (headline + the
 * Check an agent button) and shoots each section (tests/e2e/screenshots.spec.ts).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  STORY_HEADLINE, STORY_SUB, STORY_STEPS, STORY_SECTIONS, storyEyebrow, CLOSING_HEADLINE, CLOSING_REASSURE, CLOSING_PILL,
  FOOTER_BRAND, CONTEXT_EMPTY, FIRST_TRUST_NOTE, OVER_TIME_FEW, OVER_TIME_UNREAD, GATE_UNREAD, CONTEXTS_UNREAD, contextsFeatured,
} from '../people-copy'
import type { AgentsPageView } from '../agents-page-types'
import type { AttestedEntry } from '../attestation-reader'
import { CANONICAL_DOMAINS_REGISTRY } from '../canonical-domains'
import { contextSummaries, featuredContext, agentsByPeople, topByPeople, pickStoryAgent, initialsOf } from '../landing-story'
import { TRUST_CONTEXTS, contextSlug, contextBySlug, contextHref } from '../trust-contexts'
import { curveGeometry, isFirstTrust, shouldDrawCurve, sortEvents, trustSteps, MIN_CHART_EVENTS, type TrustEvent } from '../trust-events-view'
import { AGENT_TIER_DISPLAY } from '../agent-tier'
import { TrustOverTimeCard, TrustOverTimeUnread } from '../../components/trust/TrustOverTimeCard'
import { gateCallLine, GateExample } from '../../components/landing/GateExample'
import { TrustContexts } from '../../components/landing/TrustContexts'
import { TrustOverTime } from '../../components/landing/TrustOverTime'

const SRC = path.join(__dirname, '..', '..')
const read = (f: string) => readFileSync(path.join(SRC, f), 'utf8')
const code = (f: string) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const E18 = 10n ** 18n
const KRYPTO = '0x139219107C1eBE569f543C581b3B807Cf6740006'
const CCA0 = '0xCCA0592b0bf23C10aFc58f65d28eE8C0E78aA21C'
const LUDA = '0x82d87d9517b68e653418c0e49805b36aca3e33a00536af25fc319f5c24802c5a'
const DACKIE = '0x45078ae569def2264355f77e592028dd6f1f5d6373c204fe82bf3141ab1861fb'
const [CRYPTO, AI, KNOWLEDGE, SOCIAL] = CANONICAL_DOMAINS_REGISTRY

const entry = (agentId: string, agentName: string, domain: (typeof CANONICAL_DOMAINS_REGISTRY)[number], stakes: Array<[string, bigint]>): AttestedEntry => ({
  agentId, agentName, domain, distinctAttesters: stakes.filter(([, s]) => s > 0n).length, attesters: stakes.map(([w]) => w),
  attesterStakes: stakes.map(([wallet, shares]) => ({ wallet, shares })), totalStake: stakes.reduce((a, [, s]) => a + s, 0n),
  opposeStake: 0n, positionCount: stakes.length, score: stakes.length * 10,
})

/** The live shape on 2026-11-15: Luda (2 people, 3 contexts), Captain Dackie (1, Crypto / Onchain), OPEN CLAW (nobody). */
function view(over: Partial<AgentsPageView> = {}): AgentsPageView {
  return {
    agentScore: {
      status: 'ok', junk: 0, fetched: 3, total: 3, truncated: false,
      rows: [
        { term_id: LUDA, label: 'Luda', type: 'Thing', created_at: '2026-06-01T00:00:00Z' },
        { term_id: '0xopenclaw', label: 'OPEN CLAW', type: 'Thing', created_at: '2026-02-18T00:00:00Z' },
      ],
    } as unknown as AgentsPageView['agentScore'],
    cohort: { status: 'ok', total: 1, truncated: false, agents: [{ termId: DACKIE, label: 'Captain Dackie', createdAt: '2026-03-01T00:00:00Z' }] },
    attestations: new Map([
      [LUDA, [
        entry(LUDA, 'Luda', KNOWLEDGE, [[KRYPTO, 3069n * E18 / 100000n]]),
        entry(LUDA, 'Luda', SOCIAL, [[CCA0, 495n * E18 / 100000n]]),
        entry(LUDA, 'Luda', AI, [[KRYPTO, 99n * E18 / 10000n]]),
      ]],
      [DACKIE, [entry(DACKIE, 'Captain Dackie', CRYPTO, [[KRYPTO, 99n * E18 / 10000n]])]],
      ['0xopenclaw', []],
      // An atom the list doesn't show (junk-filtered): never counted.
      ['0xjunk', [entry('0xjunk', 'test fixture', CRYPTO, [[CCA0, E18]])]],
    ]),
    parts: [], unreachable: false,
    ...over,
  }
}

const ev = (wallet: string, context: string, at: string, tripleId = `0x${context.length}${at.slice(5, 7)}`): TrustEvent => ({ wallet, ens: null, context, at, tripleId })
const LUDA_EVENTS = [
  ev(KRYPTO, 'Knowledge / Productivity', '2026-07-11T05:58:16+00:00', '0x54c6'),
  ev(CCA0, 'Social', '2026-10-01T21:06:16+00:00', '0x8e7d'),
  ev(KRYPTO, 'AI / Coding', '2026-10-18T10:48:18+00:00', '0xad49'),
]

describe('the page: numbered sections, in order', () => {
  it('Hero → 01 → 02 → 03 → 04 → the closing block; no carousel, no features grid, no hero example card', () => {
    const page = code('app/page.tsx')
    const order = ['<Hero />', '<HowItWorks />', '<TrustOverTime ', '<GateExample ', '<TrustContexts ', '<CTA />'].map((t) => page.indexOf(t))
    expect(order.every((i) => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    for (const gone of ['FeaturedAgents', 'Features', 'ForDevelopers', 'ExampleAgentCard']) {
      expect(existsSync(path.join(SRC, `components/landing/${gone}.tsx`)), gone).toBe(false)
    }
  })
  it('rendered on the server and regenerated (ISR); fetches never land in Next\'s data cache', () => {
    const page = read('app/page.tsx')
    expect(page).toMatch(/export const dynamic = 'force-static'/)
    expect(page).toMatch(/export const revalidate = 120/)
    expect(page).toMatch(/export const fetchCache = 'default-no-store'/)
    expect(page).toMatch(/await getLandingData\(\)/)
    expect(page).not.toMatch(/'use client'/)
  })
  it('the sections are server components: no "use client" in any of them', () => {
    for (const f of ['Hero', 'HowItWorks', 'TrustOverTime', 'GateExample', 'TrustContexts', 'CTA', 'story-parts']) {
      expect(read(`components/landing/${f}.tsx`), f).not.toMatch(/^'use client'/m)
    }
    expect(read('components/trust/TrustOverTimeCard.tsx')).not.toMatch(/^'use client'|useState|useEffect/m)
    expect(read('components/layout/Footer.tsx')).not.toMatch(/^'use client'/m)
  })
  it('each section has a mono eyebrow "■ 0N / …" in order', () => {
    expect(Object.values(STORY_SECTIONS).map(storyEyebrow)).toEqual(['01 / How it works', '02 / Trust over time', '03 / Agents ask first', '04 / Trust contexts'])
  })
})

describe('the copy (from the spec)', () => {
  it('hero: headline with "real people" on the accent block, one line, two ways in', () => {
    expect(`${STORY_HEADLINE.before} ${STORY_HEADLINE.accent}${STORY_HEADLINE.after}`.toUpperCase()).toBe('AI AGENTS, TRUSTED BY REAL PEOPLE.')
    expect(STORY_SUB).toBe('See who trusts an agent, and for what, before you use it, pay it, or let your agent call it.')
    const hero = code('components/landing/Hero.tsx')
    expect(hero).toMatch(/<AccentBlock>\{STORY_HEADLINE\.accent\}<\/AccentBlock>/)
    expect(hero.indexOf('href="/check"')).toBeLessThan(hero.indexOf('href="#how-it-works"'))
    expect(read('components/landing/HowItWorks.tsx')).toMatch(/id="how-it-works"/)
  })
  it('01: find it, trust it, agents ask — should_i_trust printed as code', () => {
    expect(STORY_STEPS.map((s) => `${s.num} ${s.title}`)).toEqual(['01 Find it', '02 Trust it', '03 Agents ask'])
    expect(STORY_STEPS[0].line).toBe('Any agent: AgentScore or the ERC-8004 registry.')
    expect(STORY_STEPS[1].line).toBe('Choose a trust context and sign. One wallet can never do it alone.')
    expect(`${STORY_STEPS[2].line} ${STORY_STEPS[2].code} ${STORY_STEPS[2].after}`).toBe('Before an agent pays or delegates, it asks should_i_trust and gets yes, no or unknown.')
  })
  it('closing block and footer', () => {
    expect(`${CLOSING_HEADLINE.before} ${CLOSING_HEADLINE.accent} ${CLOSING_HEADLINE.after}`.toUpperCase()).toBe('YOUR AGENT NEEDS PEOPLE WHO TRUST IT.')
    expect(CLOSING_REASSURE).toBe('Free on Intuition Testnet · Bring one agent you’ve used')
    expect(CLOSING_PILL.toUpperCase()).toBe('TESTNET BETA')
    expect(FOOTER_BRAND).toBe('Built on Intuition.')
    const footer = read('components/layout/Footer.tsx')
    for (const label of ['Docs', 'GitHub', 'llms.txt', 'MCP', 'X']) expect(footer).toContain(`label: '${label}'`)
    expect(footer).toMatch(/heading: 'Build'[\s\S]*heading: 'Connect'/)
  })
  it('no earn / buy / sell / gains pitch, and none of Intuition\'s brand words or colours', () => {
    const pitch = /\bearn\b|\bbuy\b|\bsell\b|\bgains?\b|tradeable|Bonding Curve|market sentiment/i
    const theirs = /lime|#c6f|#bef264|#a3e635|THE BEST THINGS IN LIFE|Spot it|Grow with it|EARLY ACCESS/i
    for (const f of ['Hero', 'HowItWorks', 'TrustOverTime', 'GateExample', 'TrustContexts', 'CTA', 'story-parts']) {
      expect(code(`components/landing/${f}.tsx`), f).not.toMatch(pitch)
      expect(read(`components/landing/${f}.tsx`), f).not.toMatch(theirs)
    }
  })
})

describe('trust contexts (lib/trust-contexts.ts, lib/landing-story.ts)', () => {
  it('8 contexts with URL slugs; /domains?context=<slug>', () => {
    expect(TRUST_CONTEXTS.map((c) => c.slug)).toEqual([
      'crypto-onchain', 'ai-coding', 'knowledge-productivity', 'social', 'entertainment', 'agriculture', 'energy', 'safety-identity',
    ])
    expect(contextSlug('Knowledge / Productivity')).toBe('knowledge-productivity')
    expect(contextBySlug('crypto-onchain')?.label).toBe('Crypto / Onchain')
    expect(contextBySlug('nope')).toBeNull()
    expect(contextHref(TRUST_CONTEXTS[0])).toBe('/domains?context=crypto-onchain')
  })
  it('per context: distinct people, agents ranked by people; junk never counted; empty contexts kept', () => {
    const s = contextSummaries(view())!
    expect(s).toHaveLength(8)
    const by = Object.fromEntries(s.map((x) => [x.context.slug, x]))
    expect(by['crypto-onchain'].people).toBe(1) // Dackie's one person; the junk atom's wallet is not counted
    expect(by['crypto-onchain'].agents.map((a) => a.name)).toEqual(['Captain Dackie'])
    expect(by['knowledge-productivity'].agents.map((a) => [a.name, a.people])).toEqual([['Luda', 1]])
    expect(by.energy.people).toBe(0)
    expect(by.energy.agents).toEqual([])
  })
  it('the featured context: most people, then most agents, then most tTRUST — Knowledge / Productivity today', () => {
    expect(featuredContext(contextSummaries(view())!)?.context.label).toBe('Knowledge / Productivity')
    const empty = view({ attestations: new Map() })
    expect(featuredContext(contextSummaries(empty)!)).toBeNull()
  })
  it('a failed attestation read is unknown: no summaries at all, never 8 empty contexts', () => {
    expect(contextSummaries(view({ attestations: null }))).toBeNull()
  })
  it('a ranked list orders by distinct people first', () => {
    const v = view()
    v.attestations!.set(DACKIE, [entry(DACKIE, 'Captain Dackie', KNOWLEDGE, [[KRYPTO, 1n], [CCA0, 1n]])])
    const k = contextSummaries(v)!.find((x) => x.context.slug === 'knowledge-productivity')!
    expect(k.agents.map((a) => a.name)).toEqual(['Captain Dackie', 'Luda']) // 2 people beat 1 with far more tTRUST
  })
})

describe('the story agent: most people, a tie to the oldest trust event', () => {
  it('Luda has the most distinct people (2) today', () => {
    expect(agentsByPeople(view()).map((a) => [a.name, a.people])).toEqual([['Luda', 2], ['Captain Dackie', 1]])
    expect(topByPeople(agentsByPeople(view())).map((a) => a.name)).toEqual(['Luda'])
  })
  it('a tie goes to the oldest first trust event; an unread history can\'t win the tie', () => {
    const tied = [{ id: 'a', people: 2 }, { id: 'b', people: 2 }]
    expect(pickStoryAgent(tied, new Map([['a', '2026-10-01T00:00:00Z'], ['b', '2026-07-11T00:00:00Z']]))?.id).toBe('b')
    expect(pickStoryAgent(tied, new Map([['a', '2026-10-01T00:00:00Z'], ['b', null]]))?.id).toBe('a')
    expect(pickStoryAgent(tied, new Map())?.id).toBe('a')
    expect(pickStoryAgent([], new Map())).toBeNull()
  })
  it('initials for the tile', () => {
    expect(initialsOf('Captain Dackie')).toBe('CD')
    expect(initialsOf('Luda')).toBe('LU')
    expect(initialsOf('OPEN CLAW')).toBe('OC')
  })
})

describe('trust over time: the curve only from 3 events, never through 2 points', () => {
  it('MIN_CHART_EVENTS is 3; 0, 1 and 2 events draw no curve', () => {
    expect(MIN_CHART_EVENTS).toBe(3)
    expect([0, 1, 2, 3].map((n) => shouldDrawCurve(LUDA_EVENTS.slice(0, n)))).toEqual([false, false, false, true])
  })
  it('the running count, oldest first; steps, not slopes; ends at now', () => {
    expect(trustSteps([...LUDA_EVENTS].reverse()).map((s) => s.count)).toEqual([1, 2, 3])
    const g = curveGeometry(LUDA_EVENTS, '2026-11-15T00:00:00Z', 520, 200)
    expect(g.dots).toHaveLength(3)
    expect(g.top).toBe(3)
    expect(g.line).not.toMatch(/ L /) // horizontal and vertical moves only
    expect(g.line.startsWith(`M ${g.startX} `)).toBe(true)
    expect(g.line.endsWith(`H ${g.endX}`)).toBe(true)
  })
  it('the first trust in AgentScore\'s history is marked only when the data says so', () => {
    const first = { wallet: KRYPTO.toLowerCase(), tripleId: '0x54C6', at: '2026-07-11T05:58:16+00:00' }
    expect(isFirstTrust(LUDA_EVENTS[0], first)).toBe(true)
    expect(isFirstTrust(LUDA_EVENTS[2], first)).toBe(false)
    expect(isFirstTrust(LUDA_EVENTS[0], null)).toBe(false)
    expect(sortEvents([LUDA_EVENTS[2], LUDA_EVENTS[0]])[0]).toBe(LUDA_EVENTS[0])
  })
})

describe('the card renders each state honestly', () => {
  const props = {
    agentId: LUDA, agentName: 'Luda', names: { [KRYPTO.toLowerCase()]: 'kryptoremontier.eth' }, first: null, people: 2,
    tier: { display: AGENT_TIER_DISPLAY.unverified, attesters: 2 }, readAt: '2026-11-15T10:00:00.000Z', now: '2026-11-15T10:00:00.000Z',
  }
  it('3 events: the curve, three numbered events, the big number, the tier chip and the age', () => {
    const html = renderToStaticMarkup(createElement(TrustOverTimeCard, { ...props, events: LUDA_EVENTS, first: { wallet: KRYPTO, tripleId: '0x54c6', at: LUDA_EVENTS[0].at } }))
    expect(html).toContain('data-curve="yes"')
    expect(html.match(/data-testid="trust-event"/g)).toHaveLength(3)
    expect(html).toMatch(/>01<[\s\S]*kryptoremontier\.eth[\s\S]*trusted <span[^>]*>Luda<\/span> for <span[^>]*>Knowledge \/ Productivity<\/span>[\s\S]*Jul 11, 2026/)
    expect(html).toContain(FIRST_TRUST_NOTE)
    expect(html.match(/data-testid="first-trust"/g)).toHaveLength(1)
    expect(html).toMatch(/data-testid="people-number"><span[^>]*>2<\/span> <span[^>]*>people trust it<\/span>/)
    expect(html).toContain('2 of 3 people needed to verify')
    expect(html).toContain('data-testid="data-age"')
  })
  it('2 events: no chart, only the events list, and it says why', () => {
    const html = renderToStaticMarkup(createElement(TrustOverTimeCard, { ...props, events: LUDA_EVENTS.slice(0, 2) }))
    expect(html).toContain('data-curve="no"')
    expect(html).not.toContain('<svg viewBox="0 0 520 200"')
    expect(html).toContain(OVER_TIME_FEW)
    expect(html.match(/data-testid="trust-event"/g)).toHaveLength(2)
  })
  it('more than 5 events: the latest 5, numbered by their place in the whole history', () => {
    const many = Array.from({ length: 7 }, (_, i) => ev(`0x${String(i).padStart(40, '0')}`, 'Social', `2026-0${i + 1}-01T00:00:00Z`, `0x${i}`))
    const html = renderToStaticMarkup(createElement(TrustOverTimeCard, { ...props, events: many }))
    expect(html.match(/data-testid="trust-event"/g)).toHaveLength(5)
    expect(html).toMatch(/>03<[\s\S]*>07</)
    expect(html).not.toMatch(/>02</)
    expect(html).toContain('Showing the latest 5 of 7')
  })
  it('a failed read: the honest error, never a placeholder card', () => {
    const html = renderToStaticMarkup(createElement(TrustOverTimeUnread))
    expect(html).toContain(OVER_TIME_UNREAD)
    expect(html).toContain('data-state="failed"')
    expect(html).not.toContain('data-testid="trust-event"')
    expect(renderToStaticMarkup(createElement(TrustOverTime, { story: { status: 'failed' }, now: props.now }))).toContain(OVER_TIME_UNREAD)
  })
  it('the tier unread: says so, never a default "Unverified"', () => {
    const html = renderToStaticMarkup(createElement(TrustOverTimeCard, { ...props, events: LUDA_EVENTS, tier: null }))
    expect(html).toContain('Tier unavailable')
    expect(html).not.toContain('>Unverified<')
  })
})

describe('03: the gate, from a real answer', () => {
  it('the call as a reader writes it', () => {
    expect(gateCallLine(LUDA, { minPeople: 1, area: 'Knowledge / Productivity' })).toBe('should_i_trust({ agentId: "0x82d8…2c5a", minPeople: 1, area: "Knowledge / Productivity" })')
  })
  it('the answer is the gate\'s own JSON (dataAgeSeconds in it), from trustGate on the server — never hand-typed', () => {
    const answer = {
      decision: 'allow' as const, reason: '1 person trusts this agent for Knowledge / Productivity; your policy needs at least 1.', tier: 'unverified' as const,
      peopleVouching: 1, areas: [{ area: 'Knowledge / Productivity', people: 1, tTrust: '0.03069' }], policy: { minPeople: 1, area: 'Knowledge / Productivity' },
      meta: { dataAgeSeconds: 12, dataReadAt: '2026-11-15T10:00:00.000Z' },
    }
    const html = renderToStaticMarkup(createElement(GateExample, { gate: { status: 'ok', value: { agentId: LUDA, agentName: 'Luda', policy: answer.policy, answer } } }))
    expect(html).toContain('&quot;dataAgeSeconds&quot;: 12')
    expect(html).toContain('&quot;decision&quot;: &quot;allow&quot;')
    const data = code('lib/landing-data.ts')
    expect(data).toMatch(/runWithReadLedger\(\(\) => trustGate\(chosen\.id, policy\)\)/)
    // An `unknown` answer is a failed read: the section shows the error, not the answer.
    expect(data).toMatch(/answer\.value\.decision === 'unknown'\) return \{ status: 'failed' \}/)
    expect(read('components/landing/GateExample.tsx')).not.toMatch(/"decision"|'allow'/)
  })
  it('a failed answer says so', () => {
    expect(renderToStaticMarkup(createElement(GateExample, { gate: { status: 'failed' } }))).toContain(GATE_UNREAD)
  })
})

describe('04: the contexts grid — empty contexts invite, never hide', () => {
  it('8 tiles, each linking to its ranked list; an empty one says "Be the first."', () => {
    const summaries = contextSummaries(view())!
    const html = renderToStaticMarkup(createElement(TrustContexts, { contexts: { status: 'ok', value: { summaries, featured: featuredContext(summaries), dataReadAt: '2026-11-15T10:00:00.000Z' } } }))
    expect(html.match(/data-testid="context-tile"/g)).toHaveLength(8)
    expect(html).toContain('href="/domains?context=energy"')
    expect(html).toMatch(/data-context="energy" data-people="0"[\s\S]*?No one trusts an agent here yet\.[\s\S]*?Be the first\./)
    expect(html).toContain(contextsFeatured('Knowledge / Productivity'))
    expect(html).toMatch(/>LU<[\s\S]*Luda[\s\S]*1 person trusts it/)
    expect(CONTEXT_EMPTY).toEqual({ line: 'No one trusts an agent here yet.', cta: 'Be the first.' })
  })
  it('a failed read says so — no tiles drawn as if empty', () => {
    const html = renderToStaticMarkup(createElement(TrustContexts, { contexts: { status: 'failed' } }))
    expect(html).toContain(CONTEXTS_UNREAD)
    expect(html).not.toContain('data-testid="context-tile"')
  })
})

describe('getLandingData: a failed read is a failed part, never an empty one', () => {
  beforeEach(() => { vi.resetModules() })
  it('the list unreachable → every live part failed', async () => {
    vi.doMock('../agents-page-data', () => ({ getAgentsPageData: async () => { throw new Error('down') } }))
    const { getLandingData } = await import('../landing-data')
    expect(await getLandingData()).toEqual({ contexts: { status: 'failed' }, story: { status: 'failed' }, gate: { status: 'failed' } })
    vi.doUnmock('../agents-page-data')
  })
})

describe('no illustrative data', () => {
  it('no example people or agents written into the landing — every name comes from a read', () => {
    for (const f of ['components/landing/TrustOverTime.tsx', 'components/landing/GateExample.tsx', 'components/landing/TrustContexts.tsx', 'components/trust/TrustOverTimeCard.tsx', 'lib/landing-data.ts', 'lib/landing-story.ts']) {
      expect(code(f), f).not.toMatch(/Luda|Dackie|kryptoremontier|OPEN CLAW|Midnight City|Kai /)
    }
  })
})
