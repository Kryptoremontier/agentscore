/**
 * Etap 5b Run 1 commit 1 — people-first vocabulary on the agent surfaces. One verb ("vouch"),
 * one copy module (lib/people-copy.ts, REPO_MAP §7 rule 4), and the machine surfaces unchanged.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import {
  people, peopleVouch, forAreas, peopleLine, tierProgress, backedLine, NOBODY_VOUCHES, VOUCH_CTA, vouchFor,
  connectToVouch, WHO_VOUCHES_HEADING, SAYS_IT_DOES_HEADING, SAYS_IT_DOES_NOTE, ERC8004_ABOUT,
} from '../people-copy'

const SRC = path.join(__dirname, '..', '..')
const ROOT = path.join(SRC, '..')
const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = path.join(dir, f)
  if (statSync(p).isDirectory()) return f === '__tests__' ? [] : files(p)
  return /\.(ts|tsx)$/.test(f) ? [p] : []
})
/** Code only — comments may name what was replaced. */
const code = (p: string) => readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\{\s*\}/g, '')
const rel = (p: string) => path.relative(SRC, p)

/** The human-facing agent surfaces: card and list row, modal, profile, and what they mount. */
const AGENT_SURFACES = [
  ...files(path.join(SRC, 'components/agents')),
  ...files(path.join(SRC, 'components/profile')),
  ...files(path.join(SRC, 'components/attest')),
  path.join(SRC, 'app/agents/page.tsx'),
  path.join(SRC, 'app/agents/[id]/page.tsx'),
]

describe('the copy', () => {
  it('people, and the people line: the area named when one, counted when more', () => {
    expect([people(0), people(1), people(2)]).toEqual(['0 people', '1 person', '2 people'])
    expect([peopleVouch(1), peopleVouch(3)]).toEqual(['1 person vouches', '3 people vouch'])
    expect(forAreas(['Knowledge / Productivity'])).toBe('for Knowledge / Productivity')
    expect(forAreas(['Social', 'Energy'])).toBe('for 2 areas')
    expect(peopleLine(1, ['Knowledge / Productivity'])).toBe('1 person vouches · for Knowledge / Productivity')
    expect(NOBODY_VOUCHES).toBe('Nobody vouches yet')
  })

  it('the tier chip keeps its name; the subtitle counts people', () => {
    expect(tierProgress(1, 3)).toBe('1 of 3 people needed to verify')
    expect(tierProgress(null, 3)).toBe('— of 3 people needed to verify')
  })

  it('the backing line: amount, wallets, signals; unread is "—", nobody is said plainly', () => {
    const wei = 335_100_000_000_000_000n
    expect(backedLine({ count: 1, atomVaultWei: wei }, 16)).toBe('Backed with 0.3351 tTRUST by 1 wallet · 16 signals')
    expect(backedLine({ count: 0, atomVaultWei: 0n }, 0)).toBe('No tTRUST backing yet')
    expect(backedLine(null, null)).toBe('Backed with — by —')
  })

  it('the map from the spec', () => {
    expect(VOUCH_CTA).toBe('Vouch for this agent')
    expect(connectToVouch('Luda')).toBe('Connect a wallet to vouch for Luda.')
    expect(vouchFor('Luda')).toBe('Vouch for Luda')
    expect(WHO_VOUCHES_HEADING.toUpperCase()).toBe('WHO VOUCHES, AND FOR WHAT')
    expect(`${SAYS_IT_DOES_HEADING.toUpperCase()} ${SAYS_IT_DOES_NOTE}`).toBe('SAYS IT DOES — self-declared, nobody has vouched yet')
    expect(ERC8004_ABOUT).toBe('Listed in the ERC-8004 agent registry. It describes itself; people here can vouch for it.')
  })
})

describe('one copy module — the old words are gone from the agent surfaces, the new ones live in one place', () => {
  const OLD = [
    'Attest Competence', 'Connect wallet to attest', 'Connect a wallet to attest', 'No attestations yet', 'Attested Domains',
    'Declared Domains', 'staked on-chain claims with visible authors', 'not yet attested', 'attested by',
    'Domains attested', 'Domain attested', 'tTRUST attested', 'on atom vault', 'Atom ID:', "'Attester'", "'Attesters'",
    'attesters</span>', 'registry cohort — self-declared', 'not a domain attestation', 'Backing is not attesting',
  ]
  it.each(AGENT_SURFACES.map((f) => [rel(f), f]))('%s', (_name, f) => {
    const src = code(f)
    for (const s of OLD) expect(src, s).not.toContain(s)
  })

  it('the new strings are written only in lib/people-copy.ts', () => {
    const NEW = ['Vouch for this agent', 'Nobody vouches yet', 'Who vouches, and for what', 'people needed to verify', 'Backed with', 'Says it does', 'Listed in the ERC-8004 agent registry', 'Find an AI agent and see who vouches', 'Real people vouch for AI agents, on-chain. One wallet', 'who know your agent', 'you’ve backed with tTRUST', 'rely on this skill']
    const hits = files(SRC).filter((f) => !f.endsWith(path.join('lib', 'people-copy.ts'))).flatMap((f) => {
      const src = code(f)
      return NEW.filter((s) => src.includes(s)).map((s) => `${rel(f)}: ${s}`)
    })
    expect(hits).toEqual([])
  })
})

describe('the /agents header: plain words, no staking pitch', () => {
  it('"Agents" and "Find an AI agent and see who vouches for it, and for what."', async () => {
    const { AGENTS_PAGE_TITLE, AGENTS_PAGE_SUB } = await import('../people-copy')
    expect(AGENTS_PAGE_TITLE).toBe('Agents')
    expect(AGENTS_PAGE_SUB).toBe('Find an AI agent and see who vouches for it, and for what.')
    const page = code(path.join(SRC, 'app/agents/page.tsx'))
    expect(page).toMatch(/<h1[^>]*>\s*\{AGENTS_PAGE_TITLE\}\s*<\/h1>/)
    expect(page).toMatch(/\{AGENTS_PAGE_SUB\}/)
    expect(page).not.toMatch(/Intelligence Registry|to signal\s+confidence|Decentralized trust verification/)
  })
})

describe('footer, /register and the Supporting tab: plain words from the copy module', () => {
  it('the footer tagline is the landing line itself — imported, never copied', async () => {
    const { LANDING_SUB } = await import('../people-copy')
    expect(LANDING_SUB).toBe('Real people vouch for AI agents, on-chain. One wallet can never do it alone.')
    const footer = code(path.join(SRC, 'components/layout/Footer.tsx'))
    expect(footer).toMatch(/import \{[^}]*\bLANDING_SUB\b[^}]*\} from '@\/lib\/people-copy'/)
    expect(footer).toMatch(/<p[^>]*>\s*\{LANDING_SUB\}\s*<\/p>/)
    expect(footer).not.toMatch(/Decentralized trust verification|to signal\s+confidence|every vote is transparent/)
    const copy = readFileSync(path.join(SRC, 'lib/people-copy.ts'), 'utf8')
    expect(copy.split(LANDING_SUB).length - 1).toBe(1)
  })

  it('/register "Build Trust": vouched for on the agent tab, backed on the skill tab', async () => {
    const { REGISTER_BUILD_TRUST, REGISTER_BUILD_TRUST_SKILL } = await import('../people-copy')
    expect(REGISTER_BUILD_TRUST).toBe('Get vouched for by people who know your agent’s work.')
    expect(REGISTER_BUILD_TRUST_SKILL).toBe('Get backed with tTRUST by people who rely on this skill.')
    const page = code(path.join(SRC, 'app/register/page.tsx'))
    expect(page).toMatch(/desc: activeTab === 'agent' \? REGISTER_BUILD_TRUST : REGISTER_BUILD_TRUST_SKILL,/)
    expect(page).not.toMatch(/Earn reputation/)
  })

  it('the Supporting tab, empty: backing is not vouching', async () => {
    const { NO_POSITIONS_NOTE } = await import('../people-copy')
    expect(NO_POSITIONS_NOTE).toBe('Agents and skills you’ve backed with tTRUST. Backing is not vouching — it doesn’t change an agent’s tier.')
    const tab = code(path.join(SRC, 'components/profile/MySupportedAgents.tsx'))
    expect(tab).toMatch(/\{NO_POSITIONS_NOTE\}/)
    expect(tab).not.toMatch(/Buy shares|to signal trust/)
  })
})

describe('machine surfaces do not change', () => {
  it('REST, MCP and /llms.txt never import the UI copy', () => {
    const api = [...files(path.join(SRC, 'app/api')), ...files(path.join(SRC, 'app/llms.txt'))]
    expect(api.length).toBeGreaterThan(0)
    expect(api.filter((f) => /people-copy/.test(readFileSync(f, 'utf8'))).map(rel)).toEqual([])
  })

  it('llms.txt and SKILL.md keep attest / attesters / trustScore', () => {
    const skill = readFileSync(path.join(ROOT, 'SKILL.md'), 'utf8')
    expect(skill).toMatch(/trustScore/)
    expect(skill).not.toMatch(/\bvouch/i)
  })

  it('/docs says it once: vouch (UI) = attestation (protocol)', () => {
    expect(readFileSync(path.join(SRC, 'app/docs/page.tsx'), 'utf8')).toContain('vouch (UI) = attestation (protocol)')
  })
})
