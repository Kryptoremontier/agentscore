/**
 * Etap 6b polish — the landing's first screen after the new type:
 *   1. The page background's horizon glow shows in the hero again on desktop. 6b's hero was shorter
 *      (553–674px against 759px before), so its dark bottom overlay sat on the horizon and the next
 *      section's solid ground covered the rest. The hero keeps its pre-6b height on desktop, under
 *      the same two overlays, over the same untouched page background.
 *   2. No dead band before How it works: its top padding no longer stacks on the hero's.
 *   3. The example card: its top meets the headline's on desktop, larger, the seals a column each
 *      (SealRow md: ring, then name and area under it).
 *   4. The section eyebrows: the mono amber "// …" line, like the hero's and the pages'.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { AttesterSummary } from '../agent-profile'
import { SealRow } from '../../components/agents/SealRow'

const SRC = path.join(__dirname, '..', '..')
const code = (f: string) => readFileSync(path.join(SRC, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
const hero = code('components/landing/Hero.tsx')
const T = 10n ** 15n

describe('1 — the background glow in the hero', () => {
  it('the hero keeps its pre-6b height on desktop (759px, 153dcb7), the 6b content centred in it', () => {
    expect(hero).toMatch(/<section className="relative overflow-hidden lg:min-h-\[759px\] lg:flex lg:flex-col lg:justify-center">/)
    // The content centres in what shows under the fixed 64px header: top padding = bottom + 64px.
    expect(hero).toMatch(/lg:pt-24 lg:pb-8 /)
  })

  it('the same two overlays as before 6b, over the same page background', () => {
    expect(hero).toContain('<div className="absolute inset-0 bg-gradient-to-b from-[rgb(10,10,15)]/70 via-transparent to-[rgb(10,10,15)]/80" />')
    expect(hero).toContain('<div className="absolute inset-0 shadow-[inset_0_0_200px_rgba(0,0,0,0.7)]" />')
    expect(hero.match(/className="absolute inset-0/g)).toHaveLength(2)
    expect(hero).not.toMatch(/\bbg-\[#|bg-black|backgroundColor/)
    const layout = code('app/layout.tsx')
    expect(layout).toMatch(/backgroundImage: "url\('\/images\/brand\/gold\/background\.png'\)",\s*backgroundSize: 'cover',\s*backgroundPosition: 'center top',\s*backgroundAttachment: 'fixed'/)
    expect(layout).toContain('<div className="fixed inset-0 bg-[rgb(10,10,15)]/75 pointer-events-none z-0" />')
  })
})

describe('2 — no dead band before How it works', () => {
  it('How it works opens with a short top padding (it used to add 96–128px to the hero\'s own)', () => {
    const how = code('components/landing/HowItWorks.tsx')
    expect(how).toMatch(/<section id="how-it-works" className="relative pt-12 pb-24 sm:pt-16 sm:pb-32 /)
    expect(how).not.toMatch(/py-24 sm:py-32/)
  })
})

describe('3 — the example card', () => {
  it('top-aligned with the headline on desktop: the grid aligns to the start, the card drops by the eyebrow line + the headline\'s mt-3', () => {
    expect(hero).toMatch(/lg:items-start text-left"/)
    expect(hero).toMatch(/<p className="eyebrow eyebrow-slash text-accent">\{HERO_EYEBROW\}<\/p>\s*<motion\.h1[\s\S]*?className="mt-3 /)
    expect(hero).toMatch(/<div data-story="5" className="lg:pt-7">/)
  })

  it('larger on desktop: the whole column, more room, a larger name and line; one fixed height per breakpoint', () => {
    const card = code('components/landing/ExampleAgentCard.tsx')
    expect(card).toMatch(/const BOX = 'block w-full rounded-2xl border text-left px-4 py-3 h-\[160px\] lg:px-6 lg:py-5 lg:h-\[204px\]'/)
    expect(card).not.toMatch(/max-w-md/)
    // …in a wider right column (1.3fr → 1.2fr against 1fr): "kryptoremontier.eth" fits its seal column at ≥ 1440px.
    expect(hero).toMatch(/lg:grid-cols-\[minmax\(0,1\.2fr\)_minmax\(0,1fr\)\]/)
    expect(card).toMatch(/text-base lg:text-xl/)
    expect(card).toMatch(/<SealRow attesters=\{agent\.attesters\} size="md" className="mt-2 lg:mt-3" \/>/)
    // The tiers "?" ends the people line it explains, so the seal columns get the card's full width.
    expect(card).toMatch(/\{agent\.line\.claim \?\? '—'\}\s*<\/p>\s*<Explainer term="tiers" \/>/)
  })

  it('SealRow md: a column per slot — the seal, then the name and the area under it; open slots keep the height', () => {
    const p = (n: number, stake: bigint, domains: string[]): AttesterSummary =>
      ({ wallet: `0x${String(n).padStart(4, '0')}aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`, domains, totalStake: stake })
    const html = renderToStaticMarkup(createElement(SealRow, { attesters: [p(1, 2n * T, ['Knowledge / Productivity'])], size: 'md' }))
    expect(html).toMatch(/<ul aria-label="1 person vouches\. Verified takes 3 people\." class="grid grid-cols-3 gap-1\.5">/)
    const filled = html.match(/<li[^>]*data-seal="filled"[^>]*>([\s\S]*?)<\/li>/)!
    expect(filled[0]).toMatch(/class="flex flex-col items-center text-center/)
    // ring → name → area, top to bottom
    const [ring, name, area] = ['rounded-full', '>0x0001...aaaa<', '>Knowledge / Productivity<'].map((s) => filled[1].indexOf(s))
    expect(ring).toBeGreaterThanOrEqual(0)
    expect(name).toBeGreaterThan(ring)
    expect(area).toBeGreaterThan(name)
    expect(html.match(/data-seal="open"[^>]*class="flex flex-col items-center/g)).toHaveLength(2)
    expect(html.match(/aria-hidden="true" class="text-\[10px\] leading-\[14px\]">\u00a0</g)).toHaveLength(2)
  })

  it('SealRow md while loading: the same columns (ring and two bars), so the card doesn\'t move', () => {
    const html = renderToStaticMarkup(createElement(SealRow, { attesters: undefined, size: 'md' }))
    expect(html).toMatch(/class="grid grid-cols-3 gap-1\.5 ?"/)
    expect(html.match(/flex flex-col items-center gap-1 py-0\.5/g)).toHaveLength(3)
  })
})

describe('4 — section eyebrows', () => {
  it('How it works, Why AgentScore and Explore the Registry: the mono amber "// …" line, no pill', () => {
    const files = ['components/landing/HowItWorks.tsx', 'components/landing/Features.tsx', 'components/landing/FeaturedAgents.tsx']
    const want = ['Getting Started', 'Platform Features', 'Live on Intuition Testnet']
    files.forEach((f, i) => {
      const src = code(f)
      expect(src, f).toContain(`<p className="eyebrow eyebrow-slash text-accent mb-`)
      expect(src, f).toMatch(new RegExp(`eyebrow-slash text-accent mb-\\d">${want[i]}</p>`))
      expect(src, f).not.toMatch(/rounded-full mb-\d eyebrow/)
    })
  })
})
