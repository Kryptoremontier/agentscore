/**
 * Etap 9 commit 2 — the builder's door on /check/[id]: "Built this agent? Get its trust link".
 * The link is `/check/<id>?for=<context-slug>`; opened from it, the trust dialog starts on that
 * trust context (the person can still change it). Nobody trusts it yet → the post is the builder's;
 * otherwise Etap 7's. Nothing says who built or owns the agent: anyone can copy the link.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { BuilderDoor } from '../../components/check/BuilderDoor'
import { shareOnXUrl, trustLink, checkPermalink } from '../../components/check/CheckShare'
import { bestContextFor } from '../check-agent'
import { contextBySlug, TRUST_CONTEXTS } from '../trust-contexts'
import { SITE_URL } from '../site'
import {
  BUILDER_HEADING, BUILDER_SEND, BUILDER_SEND_NOTE, BUILDER_PICK_CONTEXT, builderShareText, builderShareLead, builderAsk, checkShareText, TIER_RULE,
} from '../people-copy'

const SRC = path.join(__dirname, '..', '..')
const code = (f: string) => readFileSync(path.join(SRC, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const LUDA = '0x' + 'ab'.repeat(32)
const SOCIAL = contextBySlug('social')!
const CRYPTO = contextBySlug('crypto-onchain')!

describe('the trust link', () => {
  it('/check/<id>?for=<context-slug>; no context → the plain permalink', () => {
    expect(trustLink(LUDA, SOCIAL)).toBe(`/check/${LUDA}?for=social`)
    expect(trustLink(LUDA, null)).toBe(checkPermalink(LUDA))
    for (const c of TRUST_CONTEXTS) expect(contextBySlug(new URL(`${SITE_URL}${trustLink(LUDA, c)}`).searchParams.get('for'))).toBe(c)
  })
})

describe('the best-matching trust context', () => {
  it('the one most people already trust it for; ties go to the registry order', () => {
    expect(bestContextFor([{ domains: ['Social'] }, { domains: ['Social', 'Crypto / Onchain'] }], null)).toBe(SOCIAL)
    expect(bestContextFor([{ domains: ['Social'] }, { domains: ['Crypto / Onchain'] }], null)).toBe(CRYPTO)
    // One wallet naming a context twice is one person.
    expect(bestContextFor([{ domains: ['Social', 'Social'] }, { domains: ['Crypto / Onchain'] }], null)).toBe(CRYPTO)
  })
  it('nobody yet → the first context its own declarations map to', () => {
    expect(bestContextFor([], ['technology/blockchain'])).toBe(CRYPTO)
    expect(bestContextFor([], ['not-a-domain', 'technology/software'])).toBe(contextBySlug('ai-coding'))
    // People outrank declarations.
    expect(bestContextFor([{ domains: ['Social'] }], ['technology/blockchain'])).toBe(SOCIAL)
    expect(bestContextFor(null, ['not-a-domain-anyone-declared'])).toBeNull()
  })
  it('nothing known → null: the person picks, never a guess', () => {
    expect(bestContextFor([], null)).toBeNull()
    expect(bestContextFor(null, [])).toBeNull()
    expect(bestContextFor([{ domains: ['A label that is not a trust context'] }], null)).toBeNull()
  })
  it('the server reads it: people first, then an ERC-8004 agent\'s declarations (a failed read = no suggestion)', () => {
    const data = code('lib/check-data.ts')
    expect(data).toMatch(/const fromPeople = bestContextFor\(card\.attesters, null\)/)
    expect(data).toMatch(/if \(fromPeople \|\| card\.origin !== 'erc8004'\) return fromPeople/)
    expect(data).toMatch(/loadErc8004Cohort\(\)\.then\([\s\S]*\(\) => null\)/)
  })
})

describe('the block under the card', () => {
  const door = (people: number | null, initialSlug: string | null) =>
    renderToStaticMarkup(createElement(BuilderDoor, { id: LUDA, name: 'Luda', people, initialSlug }))

  it('the heading, the link for the best-matching context, the picker with all 8, and the two lines under it', () => {
    const html = door(2, 'social')
    expect(html).toContain(BUILDER_HEADING)
    expect(BUILDER_HEADING).toBe('Built this agent? Get its trust link')
    expect(html).toContain(`value="${SITE_URL}/check/${LUDA}?for=social"`)
    expect(html).toContain('data-context="social"')
    for (const c of TRUST_CONTEXTS) expect(html).toContain(`<option value="${c.slug}"`)
    expect(html).toMatch(/<option value="social" selected="">Social<\/option>/)
    expect(html).toContain(BUILDER_SEND)
    expect(BUILDER_SEND).toBe('Send this to 3 people who have used it. Three people make it Verified.')
    // The tier rule is people AND tTRUST: the line under it says the rest, in the rule's own words.
    expect(BUILDER_SEND_NOTE).toContain(TIER_RULE.verified)
  })
  it('no context known → the person picks first: no link yet, never a guessed one', () => {
    const html = door(0, null)
    expect(html).toContain(`<option value="" selected="">${BUILDER_PICK_CONTEXT}</option>`)
    expect(html).not.toContain('data-testid="builder-link"')
    expect(html).not.toContain('data-testid="builder-share-x"')
  })
  it('0 people → the builder\'s post: "I listed {name} on AgentScore. Used it? Trust it for {context}: {link}"', () => {
    const link = `${SITE_URL}/check/${LUDA}?for=social`
    expect(builderShareText('Luda', 'Social', link)).toBe(`I listed Luda on AgentScore. Used it? Trust it for Social: ${link}`)
    const url = new URL(shareOnXUrl('Luda', 0, LUDA, SOCIAL))
    expect(url.searchParams.get('text')).toBe(builderShareLead('Luda', 'Social'))
    expect(url.searchParams.get('url')).toBe(link)
    const html = door(0, 'social')
    expect(html).toContain('data-testid="builder-share-x"')
    expect(html).toContain('data-testid="builder-copy-message"')
  })
  it('> 0 people → Etap 7\'s post and the card\'s permalink, whatever the context; the door offers no second post', () => {
    const url = new URL(shareOnXUrl('Luda', 2, LUDA, SOCIAL))
    expect(url.searchParams.get('text')).toBe(checkShareText('Luda', 2))
    expect(url.searchParams.get('url')).toBe(`${SITE_URL}/check/${LUDA}`)
    expect(door(2, 'social')).not.toContain('data-testid="builder-share-x"')
    // The card's footer keeps Etap 7's button from 1 person up; at 0 the door carries the post.
    expect(code('components/check/CheckShare.tsx')).toMatch(/\{people !== null && people > 0 && \(/)
  })
  it('who trusts it couldn\'t be read → the link only, no post', () => {
    const html = door(null, 'social')
    expect(html).toContain('data-testid="builder-link"')
    expect(html).not.toContain('data-testid="builder-share-x"')
  })
  it('never an ownership claim: anyone can copy the link, and the copy says so', () => {
    expect(BUILDER_SEND_NOTE).toMatch(/Anyone can copy this link/)
    const words = [door(0, 'social'), door(2, null), BUILDER_SEND_NOTE, builderAsk('Social'), builderShareLead('Luda', 'Social')].join(' ')
    expect(words).not.toMatch(/owner verified|verified owner|verified builder|your agent|you built|claimed/i)
    expect(code('components/check/BuilderDoor.tsx')).not.toMatch(/useAccount|isAgentOwner|wallet/i)
  })
})

describe('opened from a trust link', () => {
  it('the page reads ?for=, an unknown slug names no context, and the card gets it', () => {
    const page = code('app/check/[id]/page.tsx')
    expect(page).toMatch(/const ask = contextBySlug\(forParam\)/)
    expect(page).toMatch(/askSlug=\{ask\?\.slug \?\? null\}/)
    expect(page).toMatch(/initialSlug=\{\(ask \?\? best\)\?\.slug \?\? null\}/)
    expect(contextBySlug('nope')).toBeNull()
  })
  it('the card says what the link asks and hands the context to the dialog', () => {
    const card = code('components/check/CheckResultCard.tsx')
    expect(card).toMatch(/const ask = contextBySlug\(askSlug\)/)
    expect(card).toMatch(/\{ask && <p[^>]*data-testid="trust-ask"[^>]*>\{builderAsk\(ask\.label\)\}<\/p>\}/)
    expect(card).toMatch(/<AttestButton agentId=\{card\.id\} agentName=\{card\.name\} variant="hero" preselect=\{ask\} \/>/)
    expect(builderAsk('Social')).toBe('This link asks: do you trust it for Social? You can pick another trust context.')
  })
  it('the dialog starts on that context — and keeps its picker (the person can still change it)', () => {
    const dialog = code('components/attest/AttestButton.tsx')
    expect(dialog).toMatch(/function start\(\) \{\s*if \(preselect\) \{\s*setDomain\(preselect\)\s*setStatus\('preview'\)\s*\}\s*setOpen\(true\)\s*\}/)
    expect(dialog).toMatch(/onConnected: start \}\)/)
    expect(dialog).not.toMatch(/setOpen\(true\)[\s\S]*setOpen\(true\)/) // one way in: start()
    expect(dialog).toMatch(/CANONICAL_DOMAINS_REGISTRY\.map\(d => \(\s*<button[\s\S]*onClick=\{\(\) => \{ setDomain\(d\); setStatus\('preview'\)/)
  })
})
