import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { AGENT_TIER_LADDER } from '../agent-tier'

/**
 * Public text surfaces state the thesis agent ladder (§6 "Agent tiers"), and the old
 * vault ladder (Sandbox 3+ stakers …) only as the skills / claims / IntuForge tier.
 * Before Etap 4b-close, README, docs/TRUST_SCORING.md and /docs presented the vault
 * ladder as THE trust tiers.
 */

const SURFACES = ['README.md', 'docs/TRUST_SCORING.md', 'src/app/docs/page.tsx']
const read = (f: string) => readFileSync(f, 'utf8')

describe('public docs carry the thesis agent ladder', () => {
  it('the code ladder is the documented one (3 / 0.1, 2 / 0.05)', () => {
    expect(AGENT_TIER_LADDER.verified.minAttesters).toBe(3)
    expect(AGENT_TIER_LADDER.verified.minAttestedWei).toBe(10n ** 17n)
    expect(AGENT_TIER_LADDER.trusted.minAttesters).toBe(2)
    expect(AGENT_TIER_LADDER.trusted.minAttestedWei).toBe(5n * 10n ** 16n)
  })
  for (const f of SURFACES) {
    it(`${f}: agent tiers from attestations (≥ 3 / ≥ 0.1, ≥ 2 / ≥ 0.05); Sandbox only under the vault heading`, () => {
      const s = read(f)
      expect(s).toMatch(/Agent Tiers/)
      expect(s).toMatch(/≥ 3[\s\S]{0,80}≥ 0\.1/)
      expect(s).toMatch(/≥ 2[\s\S]{0,80}≥ 0\.05/)
      const vault = s.indexOf('Vault Tiers')
      expect(vault).toBeGreaterThan(-1)
      const sandboxRows = [...s.matchAll(/Sandbox/g)].map((m) => m.index!)
      expect(sandboxRows.length).toBeGreaterThan(0)
      // every Sandbox mention sits after the vault heading (README's release-notes line excepted: it says so)
      for (const i of sandboxRows) {
        const line = s.slice(s.lastIndexOf('\n', i) + 1, s.indexOf('\n', i))
        expect(i > vault || /skills, claims and IntuForge only/.test(line), `${f}: "${line.trim()}"`).toBe(true)
      }
    })
  }
  it('llms.txt no longer promises tier-upgrade events on an agent timeline', () => {
    expect(read('src/app/llms.txt/route.ts')).not.toMatch(/claims, tier upgrades\) plus the current score/)
  })
})
