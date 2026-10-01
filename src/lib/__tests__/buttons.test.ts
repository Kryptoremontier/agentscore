/**
 * Etap 6b commit 3 — sharp primary, outline secondary. One primary style everywhere (paper fill,
 * ink text, 2px corners, ≥ 44px, accent focus ring), including the vouch action that used to be
 * purple; one outline secondary in the same shape. Chips and tags keep their shapes.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import tailwind from '../../../tailwind.config'
import { buttonVariants } from '../../components/ui/button'

const SRC = path.join(__dirname, '..', '..')
const read = (f: string) => readFileSync(path.join(SRC, f), 'utf8')
const css = read('app/globals.css')
// A rule on its own (after the previous rule's closing brace) — not one in a selector list.
const rule = (sel: string) => css.match(new RegExp(`\\}\\s*${sel.replace(/[.:()]/g, (c) => `\\${c}`)} \\{([^}]*)\\}`))?.[1] ?? ''

const lin = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
const lum = (r: number, g: number, b: number) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)

describe('the tokens', () => {
  it('paper #F4F1EA, ink #0B0C0E, 2px corners — ink on paper reads ≥ 4.5:1 (it is 18:1)', () => {
    expect(css).toMatch(/--paper: 244 241 234;/)
    expect(css).toMatch(/--ink: 11 12 14;/)
    expect(css).toMatch(/--radius-button: 2px;/)
    const ratio = (lum(244, 241, 234) + 0.05) / (lum(11, 12, 14) + 0.05)
    expect(ratio).toBeGreaterThan(17)
    const t = tailwind.theme!.extend! as Record<string, Record<string, unknown>>
    expect(t.colors.paper).toBe('rgb(var(--paper) / <alpha-value>)')
    expect(t.colors.ink).toBe('rgb(var(--ink) / <alpha-value>)')
    expect(t.borderRadius.button).toBe('var(--radius-button)')
  })
})

describe('.btn-primary / .btn-secondary', () => {
  it('the shared shape: ≥ 44px tall, generous padding, 2px corners', () => {
    const shared = rule('.btn-secondary')
    const both = css.match(/\.btn-primary,\s*\.btn-secondary \{([^}]*)\}/)?.[1] ?? ''
    expect(both).toMatch(/min-height: 44px;/)
    expect(both).toMatch(/padding: 0\.75rem 1\.5rem;/)
    expect(both).toMatch(/border-radius: var\(--radius-button\);/)
    expect(shared).toMatch(/border: 1px solid rgb\(var\(--paper\) \/ 0\.35\);/)
  })
  it('primary: paper fill, ink text; secondary: a 1px outline, no fill', () => {
    expect(rule('.btn-primary')).toMatch(/background-color: rgb\(var\(--paper\)\);\s*color: rgb\(var\(--ink\)\);/)
    expect(rule('.btn-secondary')).toMatch(/background-color: transparent;/)
  })
  it('a visible focus ring in the accent', () => {
    expect(css).toMatch(/\.btn-primary:focus-visible,\s*\.btn-secondary:focus-visible \{\s*outline: 2px solid rgb\(var\(--accent\)\);/)
  })
})

describe('used everywhere a primary action is', () => {
  it('<Button>: default is the primary, outline the secondary, at 44px by default', () => {
    expect(buttonVariants()).toContain('btn-primary')
    expect(buttonVariants()).toContain('h-11')
    expect(buttonVariants({ variant: 'outline' })).toContain('btn-secondary')
    expect(buttonVariants({ variant: 'ghost' })).not.toMatch(/btn-/)
  })

  it('the vouch action — no longer purple: every trigger, the confirm, each step', () => {
    const attest = read('components/attest/AttestButton.tsx')
    expect(attest).toMatch(/hero: \{ className: 'btn-primary w-full md:text-base' \}/)
    expect(attest).toMatch(/inline: \{ className: 'btn-primary whitespace-nowrap' \}/)
    expect(attest).toMatch(/bar: \{ className: 'btn-primary w-full' \}/)
    expect(attest).toMatch(/card: \{ className: 'btn-secondary w-full' \}/)
    expect(attest).toMatch(/const primary = 'btn-primary w-full'/)
    expect(attest).not.toMatch(/background: '#8B5CF6'|primaryStyle|style=\{TRIGGER_STYLES/)
  })

  it('the landing: "Vouch for an agent" primary, developers secondary — first screen and closing call', () => {
    for (const f of ['components/landing/Hero.tsx', 'components/landing/CTA.tsx']) {
      const src = read(f)
      expect(src, f).toMatch(/<Link href="\/agents" className="btn-primary/)
      expect(src, f).toMatch(/<Link href="\/docs" className="btn-secondary/)
      expect(src, f).not.toMatch(/from-\[#C8963C\] to-\[#A87820\]/)
    }
  })

  it('Connect Wallet, register, clear search, back this agent', () => {
    expect(read('components/wallet/WalletButton.tsx')).toMatch(/<Button onClick=\{\(\) => openConnectModal\(\)\} className="px-3 sm:px-6">/)
    expect(read('components/agents/RegisterAgentForm.tsx')).toMatch(/className="btn-primary w-full"/)
    const agents = read('app/agents/page.tsx')
    expect(agents.match(/className="btn-primary(?: w-full)?"/g)?.length).toBeGreaterThanOrEqual(2)
    expect(read('app/skills/page.tsx')).toMatch(/className="btn-primary"/)
  })

  it('chips and tags keep their shapes', () => {
    expect(read('app/agents/page.tsx')).toMatch(/function OriginChip[\s\S]*?text-xs px-2 py-0\.5 rounded inline-block/)
    expect(read('components/agents/TrustTierBadge.tsx')).not.toMatch(/btn-primary|btn-secondary/)
  })
})
