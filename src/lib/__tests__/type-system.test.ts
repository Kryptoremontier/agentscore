/**
 * Etap 6b commit 1 — the type system. A heavy, tight display grotesk for every h1/h2 (the large
 * ones with the display rhythm), an italic accent face for one accent word per headline with our
 * own stroked swash, mono for eyebrows only; tokens in one place (globals.css :root + Tailwind).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import tailwind from '../../../tailwind.config'
import { AccentWord } from '../../components/shared/AccentWord'

const SRC = path.join(__dirname, '..', '..')
const read = (f: string) => readFileSync(path.join(SRC, f), 'utf8')
const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = path.join(dir, f)
  if (statSync(p).isDirectory()) return f === '__tests__' ? [] : files(p)
  return /\.tsx$/.test(f) ? [p] : []
})
const css = read('app/globals.css')

describe('the faces: free, loaded with next/font, named by one variable each', () => {
  it('display = Inter Tight, accent = Instrument Serif italic, mono = JetBrains Mono; body stays Inter', () => {
    const layout = read('app/layout.tsx')
    expect(layout).toMatch(/import \{ Inter, Inter_Tight, Instrument_Serif, JetBrains_Mono \} from 'next\/font\/google'/)
    expect(layout).toMatch(/Inter_Tight\(\{[\s\S]*?variable: '--font-display'/)
    expect(layout).toMatch(/Instrument_Serif\(\{[\s\S]*?style: 'italic'[\s\S]*?variable: '--font-accent'/)
    expect(layout).toMatch(/JetBrains_Mono\(\{[\s\S]*?variable: '--font-mono'/)
    expect(layout).toMatch(/Inter\(\{[\s\S]*?variable: '--font-inter'/)
    expect(layout).toMatch(/\$\{inter\.variable\} \$\{interTight\.variable\} \$\{instrumentSerif\.variable\} \$\{jetbrains\.variable\} font-sans/)
  })
})

describe('tokens in one place', () => {
  it('CSS: display tracking ≈ −0.04em (−0.03em on the already-tight Inter Tight), leading ≈ 0.95, eyebrow tracking', () => {
    expect(css).toMatch(/--tracking-display: -0\.03em;/)
    expect(css).toMatch(/--leading-display: 0\.95;/)
    expect(css).toMatch(/--tracking-eyebrow: 0\.16em;/)
  })

  it('Tailwind names them: font-display / font-accent / font-mono, tracking-display, leading-display', () => {
    const t = tailwind.theme!.extend! as Record<string, Record<string, unknown>>
    expect(t.fontFamily.display).toEqual(['var(--font-display)', 'var(--font-inter)', 'system-ui', 'sans-serif'])
    expect(t.fontFamily.accent).toEqual(['var(--font-accent)', 'Georgia', 'serif'])
    expect(t.fontFamily.mono).toEqual(['var(--font-mono)', 'monospace'])
    expect(t.letterSpacing.display).toBe('var(--tracking-display)')
    expect(t.lineHeight.display).toBe('var(--leading-display)')
  })
})

describe('h1/h2 site-wide in the display grotesk', () => {
  it('every h1 and h2 takes the display family (base layer)', () => {
    expect(css).toMatch(/@layer base \{\s*h1, h2 \{\s*font-family: var\(--font-display\)/)
  })

  it('every h1, and every h2 from text-2xl up, has the display rhythm: heavy, tight, 0.95', () => {
    const big = /(?:^|\s)(?:\w+:)?text-(?:2xl|3xl|4xl|5xl|6xl)(?:\s|$)/
    const misses: string[] = []
    for (const f of files(SRC)) {
      for (const m of readFileSync(f, 'utf8').matchAll(/<(h1|h2) className="([^"]*)"/g)) {
        const [, tag, cls] = m
        if (cls.split(/\s+/).includes('uppercase')) continue // small caps labels keep their own tracking
        if (tag === 'h2' && !big.test(` ${cls} `)) continue
        if (!/\bfont-extrabold\b/.test(cls) || !/\btracking-display\b/.test(cls) || !/\bleading-display\b/.test(cls)
          || /\b(font-bold|leading-tight|leading-none|tracking-tight|tracking-tighter)\b/.test(cls)) {
          misses.push(`${path.relative(SRC, f)}: <${tag} className="${cls}">`)
        }
      }
    }
    expect(misses).toEqual([])
  })
})

describe('<AccentWord> — the italic accent and our own swash', () => {
  const html = renderToStaticMarkup(createElement(AccentWord, null, 'AI agents.'))

  it('the italic accent face, the word itself for readers, the swash hidden from them', () => {
    expect(html).toMatch(/class="[^"]*font-accent italic[^"]*"/)
    expect(html).toContain('AI agents.')
    expect(html).toMatch(/<svg aria-hidden="true" focusable="false"/)
  })

  it('stroked, never filled; scales with the word (full width, em-based height and stroke)', () => {
    const paths = html.match(/<path [^>]*>/g) ?? []
    expect(paths.length).toBeGreaterThanOrEqual(1)
    for (const p of paths) {
      expect(p).toContain('fill="none"')
      expect(p).toContain('stroke="currentColor"')
      expect(p).toMatch(/stroke-width:0\.\d+em/)
    }
    expect(html).toContain('preserveAspectRatio="none"')
    expect(html).toMatch(/w-\[calc\(100%\+0\.12em\)\]/)
    expect(html).toMatch(/h-\[0\.3em\]/)
  })

  it('one accent word per headline at most', () => {
    for (const f of files(SRC)) {
      const src = readFileSync(f, 'utf8')
      for (const m of src.matchAll(/<(h1|h2)\b[\s\S]*?<\/\1>/g)) {
        expect((m[0].match(/<AccentWord\b/g) ?? []).length, path.relative(SRC, f)).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe('mono for eyebrows (and the landing check row) — not for data labels', () => {
  it('.eyebrow: mono, uppercase, eyebrow tracking; "//" read as nothing', () => {
    expect(css).toMatch(/\.eyebrow \{\s*font-family: var\(--font-mono\)[\s\S]*?text-transform: uppercase;\s*letter-spacing: var\(--tracking-eyebrow\);/)
    expect(css).toMatch(/\.eyebrow-slash::before \{\s*content: "\/\/ ";\s*content: "\/\/ " \/ "";/)
  })
  it('the page and section eyebrows use it', () => {
    for (const f of ['app/agents/page.tsx', 'app/skills/page.tsx', 'app/claims/page.tsx']) {
      expect(read(f), f).toMatch(/className="eyebrow eyebrow-slash /)
    }
    for (const f of ['components/landing/HowItWorks.tsx', 'components/landing/Features.tsx', 'components/landing/FeaturedAgents.tsx']) {
      expect(read(f), f).toMatch(/rounded-full mb-\d eyebrow"/)
    }
  })
})
