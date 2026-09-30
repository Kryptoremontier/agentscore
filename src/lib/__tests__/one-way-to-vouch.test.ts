/**
 * Etap 5a commit 2 — one way to vouch, and backing isn't called trust. Source guards (no DOM in
 * vitest); the harness counts the attest CTAs in the rendered DOM (tests/e2e/screenshots.spec.ts
 * oneAttestCta, on every modal and profile shot at both viewports).
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { BACKING_IS_NOT_VOUCHING } from '../people-copy'

const SRC = path.join(__dirname, '..', '..')
const read = (f: string) => readFileSync(path.join(SRC, f), 'utf8')
/** Code only — comments may name what was removed. */
const code = (f: string) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = path.join(dir, f)
  if (statSync(p).isDirectory()) return f === '__tests__' ? [] : files(p)
  return /\.(ts|tsx)$/.test(f) ? [p] : []
})

describe('backing is not called trust', () => {
  it('the profile\'s fake "Trust Agent" (a 2 s timeout that never staked) is gone; backing is "Back with tTRUST" in the collapsed section', () => {
    expect(existsSync(path.join(SRC, 'components/trust/TrustButton.tsx'))).toBe(false)
    const profile = code('app/agents/[id]/page.tsx')
    expect(profile).not.toMatch(/Trust Agent|TrustButton/)
    expect(profile).toMatch(/<BackThisAgentSection>/)
    expect(profile).toMatch(/href=\{`\/agents\?open=\$\{agentId\}&back=1`\}/)
    expect(profile).toContain('Back with tTRUST')
  })

  it('the modal and the profile share the section and its copy', () => {
    expect(BACKING_IS_NOT_VOUCHING).toBe('Put tTRUST behind this agent. Backing is not vouching — it doesn’t change the tier.')
    expect(read('components/profile/BackThisAgentSection.tsx')).toMatch(/\{BACKING_IS_NOT_VOUCHING\}/)
    const modal = read('app/agents/page.tsx')
    expect(modal).toMatch(/<BackThisAgentSection open=\{backAccordionOpen\} onToggle=/)
    expect(modal).not.toMatch(/Backing is not (attesting|vouching)/) // the copy lives in lib/people-copy.ts only
    // The profile's link lands on the modal's Back section, expanded.
    expect(modal).toMatch(/openBackOnSelect\.current = searchParams\.get\('back'\) === '1'/)
  })

  it('no "Bonding Curve Economics" promise ("your shares increase in value") renders anywhere', () => {
    const hits = files(SRC).filter((f) => /Bonding Curve Economics|shares increase in value|realize gains/.test(readFileSync(f, 'utf8')))
    expect(hits.map((f) => path.relative(SRC, f))).toEqual([])
  })
})

describe('one primary attest CTA per page', () => {
  it('the profile mounts no attest button of its own — only the Attested section (desktop) and the sticky bar (phone)', () => {
    const profile = code('app/agents/[id]/page.tsx')
    expect(profile).not.toMatch(/AttestButton|action=\{/)
    expect(profile.match(/<AttestStickyBar /g)).toHaveLength(2) // one per tier; each page renders one
  })

  it('each slot renders only at its viewport — never both in the DOM', () => {
    const bar = read('components/attest/AttestStickyBar.tsx')
    expect(bar).toMatch(/const desktop = useMediaQuery\(DESKTOP_QUERY\)\n\s*if \(desktop !== false\) return null/)
    const empty = read('components/attest/AttestEmptyState.tsx')
    expect(empty).toMatch(/\{desktop === true && <AttestButton /)
    const section = read('components/profile/AttestedDomains.tsx')
    expect(section).toMatch(/if \(desktop !== true\) return null\n\s*return <AttestButton [^>]*variant="inline"/)
    // No CSS-only hiding of an attest CTA left (that keeps two in the DOM).
    for (const f of ['components/attest/AttestStickyBar.tsx', 'components/attest/AttestEmptyState.tsx', 'components/profile/AttestedDomains.tsx']) {
      expect(read(f), f).not.toMatch(/md:hidden|hidden md:/)
    }
  })
})
