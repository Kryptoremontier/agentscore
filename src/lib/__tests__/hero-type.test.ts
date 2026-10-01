/**
 * Etap 6b commit 4 — the hero in the new type, left-aligned over the page's background: the mono
 * amber eyebrow, the headline with its one accent word, the subtitle with the live number in the
 * accent and the invitation, primary + secondary buttons, the mono check row, and the live example
 * card beside it (desktop) or below it (phone). Section headings below in the display face, one
 * of them with an accent word. The harness checks the five parts on one 390×844 screen.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { HERO_EYEBROW, LANDING_TITLE, LANDING_CHECKS, LANDING_CTA_VOUCH, DEV_HEADING, peopleHereLead, invitationLine } from '../people-copy'

const SRC = path.join(__dirname, '..', '..')
const code = (f: string) => readFileSync(path.join(SRC, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
const hero = code('components/landing/Hero.tsx')
const part = (n: number) => hero.slice(hero.indexOf(`data-story="${n}"`), n < 5 ? hero.indexOf(`data-story="${n + 1}"`) : undefined)

describe('the copy', () => {
  it('eyebrow, headline, buttons, check row — from the spec', () => {
    expect(HERO_EYEBROW).toBe('Trust layer · Live on Intuition Testnet') // shown "// TRUST LAYER · LIVE ON INTUITION TESTNET"
    expect(LANDING_TITLE).toEqual(['Trust layer for', 'AI agents.'])
    expect(LANDING_CTA_VOUCH).toBe('Vouch for an agent')
    expect(DEV_HEADING).toBe('For developers & agents')
    expect(LANDING_CHECKS).toEqual(['TESTNET tTRUST IS FREE', 'EVERY VOUCH IS ON-CHAIN', 'ONE WALLET CAN NEVER DO IT ALONE'])
  })

  it('the sentence after the subtitle leads with the live number: "1 person" — and the invitation', () => {
    expect(peopleHereLead(1)).toEqual({ lead: '1 person', rest: 'vouches for agents here.' })
    expect(peopleHereLead(3)).toEqual({ lead: '3 people', rest: 'vouch for agents here.' })
    expect(peopleHereLead(null)).toEqual({ lead: '—', rest: 'people vouch for agents here.' })
    expect(invitationLine(1)).toBe('Be the second.')
    expect(invitationLine(3)).toBe('Add yours.')
  })
})

describe('the hero, in order', () => {
  it('1: the eyebrow (mono, amber, uppercase, "//"), the headline with its accent word, the subtitle', () => {
    const p1 = part(1)
    expect(p1).toMatch(/<p className="eyebrow eyebrow-slash text-accent">\{HERO_EYEBROW\}<\/p>/)
    expect(p1).toMatch(/font-extrabold tracking-display leading-display text-white/)
    expect(p1).toMatch(/<span className="block">\{LANDING_TITLE\[0\]\}<\/span>[\s{}]*<AccentWord>\{LANDING_TITLE\[1\]\}<\/AccentWord>/)
    expect(p1).toMatch(/\{LANDING_SUB\}/)
  })

  it('2: in the sentence that follows, the live number in the accent, then the invitation', () => {
    const p2 = part(2)
    expect(p2).toMatch(/<span className="text-accent font-semibold tabular-nums"[^>]*>\{here\.lead\}<\/span>/)
    expect(p2).toMatch(/\{here\.rest\}/)
    expect(p2).toMatch(/data-testid="invitation">\{invitation\}/)
    expect(hero).toMatch(/const here = peopleHereLead\(people\.value\)/)
  })

  it('3: primary "Vouch for an agent", secondary "For developers & agents"', () => {
    const p3 = part(3)
    expect(p3).toMatch(/<Link href="\/agents" className="btn-primary[^"]*">\s*\{LANDING_CTA_VOUCH\}/)
    expect(p3).toMatch(/<Link href="\/docs" className="btn-secondary[^"]*">[\s\S]*?\{DEV_HEADING\}/)
  })

  it('4: the check row — mono, small, amber checks', () => {
    const p4 = part(4)
    expect(p4).toMatch(/font-mono text-\[11px\]/)
    expect(p4).toMatch(/LANDING_CHECKS\.map/)
    expect(p4).toMatch(/<Check aria-hidden className="w-3\.5 h-3\.5 text-accent"/)
  })

  it('5: the live example card with its seals — its own column beside the hero on desktop, below on a phone', () => {
    expect(part(5)).toMatch(/<ExampleAgentCard agent=\{example\} \/>/)
    expect(hero).toMatch(/grid grid-cols-\[minmax\(0,1fr\)\] lg:grid-cols-\[minmax\(0,1\.3fr\)_minmax\(0,1fr\)\]/)
  })

  it('left-aligned, over the existing background (its overlays kept)', () => {
    expect(hero).toMatch(/lg:items-center text-left"/)
    expect(hero).not.toMatch(/text-center|mx-auto text-center/)
    expect(hero).toMatch(/bg-gradient-to-b from-\[rgb\(10,10,15\)\]\/70 via-transparent to-\[rgb\(10,10,15\)\]\/80/)
  })
})

describe('section headings below: the display face, one accent word among them', () => {
  const how = code('components/landing/HowItWorks.tsx')
  const features = code('components/landing/Features.tsx')
  const featured = code('components/landing/FeaturedAgents.tsx')
  const cta = code('components/landing/CTA.tsx')
  const dev = code('components/landing/ForDevelopers.tsx')

  it('How It Works carries the accent word; the others are plain display type (no gradient text)', () => {
    expect(how).toMatch(/How It <AccentWord>Works<\/AccentWord>/)
    const accents = [how, features, featured, cta, dev].reduce((n, s) => n + (s.match(/<AccentWord>/g) ?? []).length, 0)
    expect(accents).toBe(1)
    expect(features).toMatch(/Why AgentScore\?/)
    expect(featured).toMatch(/Explore the Registry/)
    for (const s of [how, features, featured]) expect(s).not.toMatch(/<h2[^>]*>[\s\S]{0,80}bg-clip-text/)
  })

  it('the developers block\'s heading is in the display face too', () => {
    expect(dev).toMatch(/<h3 className="font-display [^"]*font-extrabold tracking-display leading-display[^"]*">\{DEV_HEADING\}<\/h3>/)
  })
})
