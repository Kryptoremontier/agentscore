/**
 * Etap 5b Run 1 commit 5 — leftovers from 5a: the profile's inert flag, the /agents empty state's
 * dead link, the connected wallet overflowing a 390 px header, and counts that disagree with their
 * noun ("1 Attesters"). The header is also checked live at 390 px by the stub-wallet spec.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { plural, pluralize } from '../plural'

const SRC = path.join(__dirname, '..', '..')
const code = (f: string) => readFileSync(path.join(SRC, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = path.join(dir, f)
  if (statSync(p).isDirectory()) return f === '__tests__' ? [] : files(p)
  return /\.tsx$/.test(f) ? [p] : []
})

describe('the profile has no flag button; reports stay in the modal flow', () => {
  it('the breadcrumb row holds Share only; Flag is left only as the not-found icon', () => {
    const profile = code('app/agents/[id]/page.tsx')
    expect(profile).not.toMatch(/<Button variant="ghost" size="icon">\s*<Flag/)
    expect(profile.match(/<Flag /g)).toHaveLength(1)
    expect(profile).toMatch(/<Flag className="w-8 h-8 text-red-500" \/>/)
  })
})

describe('the /agents empty state links somewhere that exists', () => {
  it('no link to /test-intuition anywhere; the empty state points at /docs', () => {
    const hits = files(SRC).filter((f) => /\/test-intuition/.test(readFileSync(f, 'utf8')))
    expect(hits.map((f) => path.relative(SRC, f))).toEqual([])
    expect(code('app/agents/page.tsx')).toMatch(/<Link href="\/docs">\s*How to register an agent →/)
  })
})

describe('the connected wallet fits a 390 px header', () => {
  it('on a phone: identicon + truncated short address, no balance, no chevron; the balance is the menu\'s first row', () => {
    const w = code('components/wallet/WalletButton.tsx')
    expect(w).toMatch(/className="glass flex items-center gap-2 px-2\.5 sm:px-4 [^"]*min-w-0 max-w-\[10\.5rem\] sm:max-w-none"/)
    expect(w).toMatch(/<span className="font-mono text-sm truncate min-w-0">/)
    expect(w).toMatch(/<span className="hidden sm:inline text-text-secondary text-sm whitespace-nowrap">\{balanceText\}<\/span>/)
    expect(w).toMatch(/data-testid="wallet-balance">\{balanceText\}/)
    expect(w).toMatch(/<span className="sm:hidden">Switch network<\/span>/)
  })
})

describe('a count agrees with its noun — one helper (lib/plural.ts)', () => {
  it('plural / pluralize', () => {
    expect([plural(1, 'staker'), plural(2, 'staker'), plural(0, 'staker')]).toEqual(['staker', 'stakers', 'stakers'])
    expect(pluralize(1, 'Person vouching', 'People vouching')).toBe('1 Person vouching')
  })
  it('no "{n} stakers" / "{n} signals" / "{n} Stakers" / "{n} Evaluators" printed without it', () => {
    const bad = /\{[\w.?]+\}\s(stakers|signals|Stakers|Evaluators|Attesters)\b|\$\{[\w.?]+\}\s(stakers|signals)\b/
    const hits = files(SRC).flatMap((f) => code(path.relative(SRC, f)).split('\n').filter((l) => bad.test(l)).map((l) => `${path.relative(SRC, f)}: ${l.trim()}`))
    expect(hits).toEqual([])
  })
})
