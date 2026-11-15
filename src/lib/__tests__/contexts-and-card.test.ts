/**
 * Etap 8b Run B — trust contexts and the agent's trust card.
 *
 * 1. /domains?context=<slug> (same route): "Agents people trust for X", distinct people first, then
 *    the existing chain; a header with the eyebrow, the big headline and "N agents · M people". The
 *    /domains overview: the landing's §04 grid, then what was there before, below it.
 * 2. The agent modal and /agents/[id]: the landing's trust-over-time card for that agent, same <3 rule.
 * 3. /check/[id]: the same card in compact form; the OG image stays as in Etap 7.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ContextRanking } from '../../components/trust/ContextRanking'
import { contextBySlug, TRUST_CONTEXTS } from '../trust-contexts'
import type { ContextSummary } from '../landing-story'
import { MODAL_NAMED_PARTS, MODAL_PARTS, MODAL_REST_PARTS, MODAL_HEADER_PARTS } from '../agents-page-types'
import { CONTEXT_EMPTY, CONTEXTS_UNREAD, contextStats, CONTEXT_UNKNOWN, OVER_TIME_NOBODY } from '../people-copy'

const SRC = path.join(__dirname, '..', '..')
const read = (f: string) => readFileSync(path.join(SRC, f), 'utf8')
const code = (f: string) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const E18 = 10n ** 18n
const KNOWLEDGE = contextBySlug('knowledge-productivity')!

describe('1 — /domains?context=<slug>: one ranked list per trust context', () => {
  const summary: ContextSummary = {
    context: KNOWLEDGE,
    people: 3,
    stakeWei: 4n * E18 / 100n,
    agents: [
      { id: '0xa', name: 'Captain Dackie', people: 2, stakeWei: E18 / 1000n, score: 20 },
      { id: '0xb', name: 'Luda', people: 1, stakeWei: 3n * E18 / 100n, score: 14 },
    ],
  }
  it('the header: eyebrow, the big headline with the context on the accent block, "N agents · M people" and its age', () => {
    const html = renderToStaticMarkup(createElement(ContextRanking, { context: KNOWLEDGE, summary, readAt: '2026-11-15T10:00:00.000Z' }))
    expect(html).toMatch(/data-testid="context-headline">Agents people trust for <span[^>]*data-testid="accent-block">Knowledge \/ Productivity<\/span>\./)
    expect(html).toContain('Trust context')
    expect(contextStats(2, 3)).toBe('2 agents · 3 people')
    expect(html).toContain('2 agents · 3 people')
    expect(html).toContain('data-testid="data-age"')
    expect(html).toContain('href="/domains"') // back to all trust contexts
  })
  it('the list keeps its order (distinct people first): 2 people before 1 with more tTRUST', () => {
    const html = renderToStaticMarkup(createElement(ContextRanking, { context: KNOWLEDGE, summary, readAt: null }))
    expect(html.indexOf('Captain Dackie')).toBeLessThan(html.indexOf('Luda'))
    expect(html).toMatch(/>01<[\s\S]*Captain Dackie[\s\S]*2 people trust it[\s\S]*>02<[\s\S]*Luda[\s\S]*1 person trusts it/)
    expect(html).toContain('href="/agents?open=0xa"')
    expect(html).not.toContain('tTRUST tTRUST') // formatTTrust carries the unit
    expect(html).toMatch(/0\.0300 tTRUST/)
  })
  it('an empty context says so and invites — never a bare empty list', () => {
    const html = renderToStaticMarkup(createElement(ContextRanking, { context: contextBySlug('energy')!, summary: { context: contextBySlug('energy')!, people: 0, stakeWei: 0n, agents: [] }, readAt: null }))
    expect(html).toContain('data-state="empty"')
    expect(html).toContain(CONTEXT_EMPTY.line)
    expect(html).toContain(CONTEXT_EMPTY.cta)
    expect(html).toContain('0 agents · 0 people')
  })
  it('a failed read says so — no "0 agents" invented', () => {
    const html = renderToStaticMarkup(createElement(ContextRanking, { context: KNOWLEDGE, summary: null, readAt: null }))
    expect(html).toContain('data-state="failed"')
    expect(html).toContain(CONTEXTS_UNREAD)
    expect(html).not.toContain('0 agents')
  })
  it('the page: same route, server-rendered, the context from ?context=; the overview is the grid, then what was there', () => {
    const page = code('app/domains/page.tsx')
    expect(page).toMatch(/export const dynamic = 'force-dynamic'/)
    expect(page).toMatch(/contextBySlug\(slug\)/)
    expect(page).toMatch(/await getTrustContexts\(\)/)
    expect(page).toMatch(/<ContextRanking context=\{context\}/)
    expect(page).toMatch(/<DomainsClient\s+top=\{[\s\S]*<TrustContextsBody contexts=\{contexts\} \/>/)
    expect(read('app/domains/domains-client.tsx')).toMatch(/^'use client'/)
    expect(code('app/domains/domains-client.tsx')).toMatch(/\{top && <div className="mb-8">\{top\}<\/div>\}[\s\S]*<AttestedSection/)
    expect(CONTEXT_UNKNOWN('nope')).toBe('There is no trust context called “nope”. Here are all of them.')
  })
  it('every landing tile links to a slug this page knows', () => {
    for (const c of TRUST_CONTEXTS) expect(contextBySlug(c.slug)).toBe(c)
  })
})

describe('2 — the agent\'s trust card: our API, one named part', () => {
  it('trustEvents is served only when asked for by name — never in the default answer or the modal\'s poll', () => {
    expect(MODAL_NAMED_PARTS).toEqual(['trustEvents'])
    expect(MODAL_PARTS as readonly string[]).not.toContain('trustEvents')
    expect([...MODAL_HEADER_PARTS, ...MODAL_REST_PARTS] as readonly string[]).not.toContain('trustEvents')
    const route = code('app/api/v1/agents/page/[id]/route.ts')
    expect(route).toMatch(/const known: readonly string\[\] = \[\.\.\.MODAL_PARTS, \.\.\.MODAL_NAMED_PARTS\]/)
  })

  describe('getAgentModalParts(trustEvents)', () => {
    beforeEach(() => { vi.resetModules() })
    afterEach(() => { vi.doUnmock('../trust-events') })
    it('the events and the first trust, as one part with its age', async () => {
      const events = [{ wallet: '0x1', ens: null, context: 'Social', at: '2026-10-01T00:00:00Z', tripleId: '0xt' }]
      vi.doMock('../trust-events', () => ({ fetchAgentTrustEvents: async () => events, fetchFirstTrust: async () => ({ wallet: '0x1', tripleId: '0xt', at: '2026-10-01T00:00:00Z' }) }))
      const { getAgentModalParts } = await import('../agents-page-data')
      const out = await getAgentModalParts('0xagent', ['trustEvents'])
      expect(Object.keys(out)).toEqual(['trustEvents'])
      expect(out.trustEvents?.status).toBe('ok')
      if (out.trustEvents?.status === 'ok') {
        expect(out.trustEvents.value.events).toEqual(events)
        expect(out.trustEvents.value.first?.tripleId).toBe('0xt')
        expect(typeof out.trustEvents.dataReadAt).toBe('string')
      }
    })
    it('a failed events read fails the part; a failed first-trust read only marks nothing', async () => {
      vi.doMock('../trust-events', () => ({ fetchAgentTrustEvents: async () => { throw new Error('down') }, fetchFirstTrust: async () => null }))
      let { getAgentModalParts } = await import('../agents-page-data')
      expect((await getAgentModalParts('0xagent', ['trustEvents'])).trustEvents).toEqual({ status: 'failed' })
      vi.resetModules()
      vi.doMock('../trust-events', () => ({ fetchAgentTrustEvents: async () => [], fetchFirstTrust: async () => { throw new Error('down') } }))
      ;({ getAgentModalParts } = await import('../agents-page-data'))
      const out = await getAgentModalParts('0xagent', ['trustEvents'])
      expect(out.trustEvents?.status === 'ok' && out.trustEvents.value).toEqual({ events: [], first: null })
    })
  })

  it('the client card: asks for that part, a cancelled flag, the failed and nobody states', () => {
    const c = code('components/trust/AgentTrustOverTime.tsx')
    expect(c).toMatch(/fetchAgentModalData\(agentId, \['trustEvents'\]\)/)
    expect(c).toMatch(/let cancelled = false[\s\S]*if \(cancelled\) return[\s\S]*return \(\) => \{ cancelled = true \}/)
    expect(c).toMatch(/if \(read\.status === 'failed'\) return <TrustOverTimeUnread/)
    expect(c).toMatch(/read\.events\.length === 0[\s\S]*\{OVER_TIME_NOBODY\}/)
    expect(c).toMatch(/<TrustOverTimeCard/)
    expect(OVER_TIME_NOBODY).toBe('Nobody trusts this agent yet. Be the first.')
  })
  it('on /agents/[id] (both views) and in the modal (loaded with the modal, never with the list)', () => {
    const profile = code('app/agents/[id]/page.tsx')
    expect(profile.match(/<AgentTrustOverTime /g)).toHaveLength(2)
    expect(profile).toMatch(/people=\{attesters\?\.length \?\? null\} tier=\{agentTier\}/)
    const modal = code('app/agents/agents-client.tsx')
    expect(modal).toMatch(/const AgentTrustOverTime = dynamic\(\(\) => import\('@\/components\/trust\/AgentTrustOverTime'\)/)
    expect(modal).toMatch(/<AgentTrustOverTime\s+agentId=\{selectedAgent\.term_id\}/)
  })
})

describe('3 — /check/[id]: the card in compact form; the OG image as in Etap 7', () => {
  it('the permalink page reads the trust story on the server and draws the compact card (or its error)', () => {
    const page = code('app/check/[id]/page.tsx')
    expect(page).toMatch(/await getTrustStory\(card\.id\)/)
    expect(page).toMatch(/story\.status !== 'ok' \? <TrustOverTimeUnread compact \/>/)
    expect(page).toMatch(/<TrustOverTimeCard[\s\S]*compact\s*\/>/)
  })
  it('the OG image is untouched: the same card read, no trust events', () => {
    const og = code('app/check/[id]/og/route.tsx')
    expect(og).toMatch(/await checkCard\(params\.id\)/)
    expect(og).not.toMatch(/getTrustStory|trust-events|TrustOverTime/)
  })

  describe('getTrustStory', () => {
    beforeEach(() => { vi.resetModules() })
    afterEach(() => { vi.doUnmock('../trust-events'); vi.doUnmock('../person-names-server') })
    it('a failed events read → failed; the first-trust and names reads are extras (null / {})', async () => {
      vi.doMock('../trust-events', () => ({ fetchAgentTrustEvents: async () => { throw new Error('down') }, fetchFirstTrust: async () => null }))
      let { getTrustStory } = await import('../trust-story-data')
      expect(await getTrustStory('0xa')).toEqual({ status: 'failed' })
      vi.resetModules()
      const events = [{ wallet: '0x139219107C1eBE569f543C581b3B807Cf6740006', ens: null, context: 'Social', at: '2026-10-01T00:00:00Z', tripleId: '0xt' }]
      vi.doMock('../trust-events', () => ({ fetchAgentTrustEvents: async () => events, fetchFirstTrust: async () => { throw new Error('down') } }))
      vi.doMock('../person-names-server', () => ({ resolvePersonNames: async () => { throw new Error('down') } }))
      ;({ getTrustStory } = await import('../trust-story-data'))
      const story = await getTrustStory('0xa')
      expect(story.status).toBe('ok')
      if (story.status === 'ok') {
        expect(story.events).toEqual(events)
        expect(story.first).toBeNull()
        expect(story.names).toEqual({})
      }
    })
  })
})
