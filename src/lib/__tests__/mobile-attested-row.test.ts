/**
 * Etap 5a commit 4 — the attested row and the profile header at 390 px. Source guards (no DOM in
 * vitest); the harness measures the rendered page at 390 px: no text overlaps inside ATTESTED, no
 * domain name cut, nothing past the viewport, no sideways scroll (tests/e2e/screenshots.spec.ts
 * attestedTextNoOverlap / profileFitsPhone / modalFitsPhone), and the modal's title clears the
 * header at normal scroll (modalTitleClearsHeader).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const read = (f: string) => readFileSync(path.join(__dirname, '..', '..', f), 'utf8')

describe('the attested row on a phone', () => {
  const row = (() => {
    const s = read('components/profile/AttestedDomains.tsx')
    return s.slice(s.indexOf('function AttestedRow'))
  })()

  it('stacks below sm: the name on its own line, the numbers under it', () => {
    expect(row).toMatch(/className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between/)
    expect(row).toMatch(/flex flex-wrap items-center gap-x-3 gap-y-1 text-xs pl-7 sm:pl-0 sm:flex-shrink-0/)
  })

  it('the domain name wraps (never truncated to nothing) and the icon never shrinks into the text', () => {
    expect(row).toMatch(/<span className="text-base leading-5 flex-shrink-0" aria-hidden="true">\{entry\.domain\.emoji\}<\/span>/)
    expect(row).toMatch(/<span className="text-sm font-semibold text-white leading-5 break-words min-w-0">\{entry\.domain\.label\}<\/span>/)
    expect(row).not.toMatch(/className="[^"]*\btruncate\b/)
  })
})

describe('the profile header on a phone', () => {
  it('the name block can shrink and wrap (a long name + the tier chip pushed OPEN CLAW\'s page to 577 px)', () => {
    const header = read('components/agents/AgentHeader.tsx')
    expect(header).toMatch(/<div className="min-w-0 flex-1">\s*<div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">/)
    expect(header).toMatch(/<h1 className="text-2xl sm:text-3xl font-bold break-words min-w-0">/)
  })
})

describe('the harness: full-height modal PNGs are not covered by fixed chrome', () => {
  it('unfixModal hides fixed/sticky elements outside the modal and their descendants (transitions off) and restores them before the checks', () => {
    const spec = readFileSync(path.join(__dirname, '../../../tests/e2e/screenshots.spec.ts'), 'utf8')
    expect(spec).toContain("'[data-shot-hidden], [data-shot-hidden] * { visibility: hidden !important; transition: none !important; }'")
    expect(spec).toMatch(/__restoreShotChrome\?\.\(\)\)\n/)
    expect(spec).toMatch(/check: modalTitleClearsHeader/)
    expect(spec).toMatch(/await profileFitsPhone\(page, project\)/)
    expect(spec).toMatch(/await attestedTextNoOverlap\(modal\)/)
  })
})
