/**
 * Etap 5b Run 2 commit 1 — the landing tells the story on one phone screen: what it is, a live
 * example (the list's most vouched agent), three steps, one number, two ways in. Below the fold:
 * how it works (people vouching), the registry, what it's built on, the way in again. No pitch.
 * The harness checks the five parts fit 390×844 (tests/e2e/screenshots.spec.ts
 * landingStoryOnOneScreen); these are the source guards.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { LANDING_SUB, LANDING_STEPS, LANDING_CTA_VOUCH, LANDING_CTA_DEVELOPERS, LIVE_ON_TESTNET, peopleVouchHereParts } from '../people-copy'
import { mostVouched } from '../most-vouched'
import type { AgentsPageView } from '../agents-page-types'
import { CANONICAL_DOMAINS_REGISTRY } from '../canonical-domains'

const SRC = path.join(__dirname, '..', '..')
const read = (f: string) => readFileSync(path.join(SRC, f), 'utf8')
const code = (f: string) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('the first screen: five parts, in order', () => {
  const hero = code('components/landing/Hero.tsx')
  it('data-story 1…5 appear in order', () => {
    expect([...hero.matchAll(/data-story="(\d)"/g)].map((m) => m[1])).toEqual(['1', '2', '3', '4', '5'])
  })
  it('the copy from the spec', () => {
    expect(LANDING_SUB).toBe('Real people vouch for AI agents, on-chain. One wallet can never do it alone.')
    expect(LANDING_STEPS).toEqual(['Find an agent', 'See who vouches, and for what', 'Vouch for one you know'])
    expect(LANDING_CTA_VOUCH).toBe('Vouch for an agent')
    expect(LANDING_CTA_DEVELOPERS).toBe('For developers & agents (MCP / REST)')
    expect(LIVE_ON_TESTNET).toBe('Live on Intuition Testnet')
    expect(peopleVouchHereParts(1)).toEqual({ count: '1', rest: 'person vouches for agents here' })
  })
  it('the CTAs: vouch → /agents (primary), developers → /docs', () => {
    const cta = hero.slice(hero.indexOf('data-story="5"'))
    expect(cta.indexOf('href="/agents"')).toBeLessThan(cta.indexOf('href="/docs"'))
    expect(cta).toMatch(/\{LANDING_CTA_VOUCH\}/)
    expect(cta).toMatch(/\{LANDING_CTA_DEVELOPERS\}/)
  })
  it('the example is the list\'s first row in its default order; the number is distinct live attesters', () => {
    expect(hero).toMatch(/mostVouched\(view, 1\)/)
    expect(hero).toMatch(/landingPeopleNumber\(statsState\)/)
  })
})

describe('below the fold, and what is gone', () => {
  it('Hero → How it works → the registry → Features → the way in again; no banner, no statistics section', () => {
    const page = code('app/page.tsx')
    const order = ['<Hero />', '<HowItWorks />', '<FeaturedAgents />', '<Features />', '<CTA />'].map((t) => page.indexOf(t))
    expect(order.every((i) => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(page).not.toMatch(/AlphaTestnetBanner|<Stats \/>/)
    expect(existsSync(path.join(SRC, 'components/landing/Stats.tsx'))).toBe(false)
    expect(existsSync(path.join(SRC, 'components/landing/AlphaTestnetBanner.tsx'))).toBe(false)
  })
  it('How it works is about people vouching; the closing call prints no stats', () => {
    const how = code('components/landing/HowItWorks.tsx')
    for (const s of LANDING_STEPS) expect(how).toContain(`title: '${s}'`)
    expect(how).toMatch(/id="how-it-works"/)
    expect(code('components/landing/CTA.tsx')).not.toMatch(/fetchLandingStats|Active Staker|Registered/)
  })
  it('no earn / buy / sell / gains / bonding-curve pitch on the landing or in its metadata', () => {
    const pitch = /\bearn\b|\bbuy\b|\bsell\b|\bgains?\b|tradeable|Bonding Curve|market sentiment/i
    for (const f of ['Hero', 'HowItWorks', 'Features', 'CTA', 'ExampleAgentCard']) {
      expect(code(`components/landing/${f}.tsx`), f).not.toMatch(pitch)
    }
    expect(code('app/layout.tsx')).not.toMatch(pitch)
  })
})

describe('mostVouched — the list\'s first rows from one page answer', () => {
  const E18 = 10n ** 18n
  const ATT = '0x1392aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0006'
  const att = (agentId: string, stake: bigint) => ({
    agentId, agentName: '', domain: CANONICAL_DOMAINS_REGISTRY[2], distinctAttesters: 1, attesters: [ATT],
    attesterStakes: [{ wallet: ATT, shares: stake }], totalStake: stake, opposeStake: 0n, positionCount: 1, score: 0,
  })
  const view = {
    agentScore: {
      status: 'ok', junk: 0, fetched: 2, total: 2, truncated: false,
      rows: [
        { term_id: '0xopenclaw', label: 'OPEN CLAW', type: 'Thing', created_at: '2026-02-18T00:00:00Z', positions_aggregate: { aggregate: { sum: { shares: (335n * E18 / 1000n).toString() } } } },
        { term_id: '0xluda', label: 'Luda', type: 'Thing', created_at: '2026-06-01T00:00:00Z', positions_aggregate: { aggregate: { sum: { shares: (E18 / 1000n).toString() } } } },
      ],
    },
    cohort: { status: 'ok', total: 1, truncated: false, agents: [{ termId: '0xdackie', label: 'Captain Dackie', createdAt: '2026-03-01T00:00:00Z' }] },
    attestations: new Map([['0xluda', [att('0xluda', 208n * E18 / 10000n)]], ['0xdackie', [att('0xdackie', 99n * E18 / 10000n)]]]),
    parts: [], unreachable: false,
  } as unknown as AgentsPageView
  it('Luda, Captain Dackie, then OPEN CLAW; the total is the list\'s "All"', () => {
    const top = mostVouched(view, 8)
    expect(top.entries.map((e) => e.agent.label)).toEqual(['Luda', 'Captain Dackie', 'OPEN CLAW'])
    expect(top.entries[1].agent.origin).toBe('erc8004')
    expect(top.total).toBe(3)
    expect(mostVouched(view, 1).entries.map((e) => e.agent.label)).toEqual(['Luda'])
  })
})
