/**
 * Etap 6b commit 2 — a brighter amber accent. One token (globals.css --accent, Tailwind `accent`)
 * for the headline's accent word, numbers highlighted inside sentences, eyebrows, the seals, the
 * focus ring and the active nav item; amber text keeps ≥ 4.5:1 on every dark ground it sits on.
 * The background image keeps its own colours.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import tailwind from '../../../tailwind.config'

const SRC = path.join(__dirname, '..', '..')
const read = (f: string) => readFileSync(path.join(SRC, f), 'utf8')
const css = read('app/globals.css')

const lin = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

describe('the token', () => {
  it('--accent is #F5A524 (245 165 36), and Tailwind\'s `accent` reads it', () => {
    expect(css).toMatch(/--accent: 245 165 36;\s*\/\* #F5A524 \*\//)
    const accent = (tailwind.theme!.extend!.colors as Record<string, Record<string, string>>).accent
    expect(accent.DEFAULT).toBe('rgb(var(--accent) / <alpha-value>)')
  })

  it('amber text is ≥ 4.5:1 on every dark ground it sits on (it is ≥ 7.8:1)', () => {
    for (const bg of ['#0F1113', '#0A0A0F', '#111318', '#171A1D', '#1E2229']) {
      expect(contrast('#F5A524', bg), bg).toBeGreaterThanOrEqual(4.5)
    }
    expect(contrast('#F5A524', '#0F1113')).toBeGreaterThan(9)
  })

  it('the background image is untouched', () => {
    expect(read('app/layout.tsx')).toMatch(/backgroundImage: "url\('\/images\/brand\/gold\/background\.png'\)"/)
  })
})

describe('where the accent is', () => {
  it('the accent word', () => {
    expect(read('components/shared/AccentWord.tsx')).toMatch(/font-accent italic font-normal tracking-normal text-accent/)
  })

  it('numbers highlighted inside a sentence (the landing\'s one number) and the invitation under it', () => {
    const hero = read('components/landing/Hero.tsx')
    expect(hero).toMatch(/text-accent font-semibold tabular-nums/)
    expect(hero).toMatch(/text-accent[^"]*" data-testid="invitation"/)
  })

  it('the seals: rings, checks and slot borders — no old gold left', () => {
    const seal = read('components/agents/SealRow.tsx')
    expect(seal).toMatch(/bg-accent\/15 border border-accent\/70/)
    expect(seal).toMatch(/text-accent/)
    expect(seal).toMatch(/border-dashed border-accent\/40/)
    expect(seal).not.toMatch(/#C8963C/)
  })

  it('the focus ring: one accent outline by default, and the rings we draw ourselves', () => {
    expect(css).toMatch(/:where\(a, button, input, select, textarea, summary, \[tabindex\]\):focus-visible \{\s*outline: 2px solid rgb\(var\(--accent\)\);/)
    for (const f of ['components/shared/Explainer.tsx', 'components/agents/AgentsStatusLine.tsx']) {
      expect(read(f), f).toMatch(/focus-visible:ring-accent\/70/)
    }
    expect(read('components/landing/ExampleAgentCard.tsx')).toMatch(/focus-visible:after:ring-accent\/70/)
  })

  it('the active nav item — sidebar, phone tabs, More — is the accent whatever the item\'s colour', () => {
    expect(read('components/layout/nav-items.ts')).toMatch(/export const ACCENT = 'rgb\(var\(--accent\)\)'/)
    const side = read('components/layout/Sidebar.tsx')
    expect(side).toMatch(/rounded-r-full bg-accent/)
    expect(side).toMatch(/color: active \? ACCENT :/)
    expect(side).toMatch(/isNavActive\('\/profile', pathname\) \? ACCENT :/)
    const mobile = read('components/layout/MobileNav.tsx')
    expect(mobile).toMatch(/color: active \? ACCENT :/)
    expect(mobile).toMatch(/color: menuOpen \? ACCENT :/)
    expect(mobile).not.toMatch(/active \? tab\.color/)
  })

  it('the eyebrows', () => {
    for (const f of ['app/agents/page.tsx', 'app/skills/page.tsx', 'app/claims/page.tsx']) {
      expect(read(f), f).toMatch(/className="eyebrow eyebrow-slash text-accent"/)
    }
  })
})
