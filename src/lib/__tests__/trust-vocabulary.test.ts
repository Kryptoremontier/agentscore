/**
 * Etap 8a — AgentScore speaks Intuition's language. On screen: people *trust* an agent for a *trust
 * context*; the middle tier reads Established. On the machine surfaces nothing a program reads
 * changes: field names, params, tool names and enum values stay exactly as they were.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { sourceFiles, uiStrings } from './user-facing-strings'
import {
  people, peopleVouch, peopleLine, forAreas, trustContexts, checkShareText, peopleVouchHereParts, peopleHereLead,
  STAT_PEOPLE, STAT_AREAS, evaluatorVouchedTip, NOBODY_VOUCHES, TIER_LABEL, ESTABLISHED_MAPPING,
} from '../people-copy'
import { AGENT_TIER_DISPLAY, AGENT_TIER_BASIS, AGENT_TIER_LADDER, type AgentTier } from '../agent-tier'
import { decideTrustGate, parseGatePolicy, GATE_AREAS } from '../trust-gate'
import { DEFAULT_SORT, SORT_OPTIONS } from '../agent-list-sort'
import { aggregateAttestations } from '../attestation-reader'

const SRC = path.join(__dirname, '..', '..')
const rel = (f: string) => path.relative(SRC, f)
const UI = [...sourceFiles(path.join(SRC, 'app')), ...sourceFiles(path.join(SRC, 'components'))]
/** Machine surfaces and the developer docs: they may name the protocol's words and the unchanged fields. */
const MACHINE_OR_DEV_DOCS = (f: string) => /^app\/(api|llms\.txt|docs)\//.test(rel(f).split(path.sep).join('/'))

describe('the old words don\'t come back', () => {
  it('no "vouch" in a user-facing string under src/app or src/components (the unchanged field name `peopleVouching` aside)', () => {
    const hits = UI.flatMap(uiStrings)
      .filter((s) => /vouch/i.test(s.text.replace(/peopleVouching/g, '')))
      .map((s) => `${rel(s.file)}:${s.line} ${s.text.slice(0, 80)}`)
    expect(hits).toEqual([])
  })

  it('no "attester" in a user-facing string outside the developer docs (/docs) and the machine surfaces (REST, MCP, llms.txt)', () => {
    const hits = UI.filter((f) => !MACHINE_OR_DEV_DOCS(f)).flatMap(uiStrings)
      .filter((s) => /attester/i.test(s.text))
      .map((s) => `${rel(s.file)}:${s.line} ${s.text.slice(0, 80)}`)
    expect(hits).toEqual([])
  })

  it('the copy module itself says "trust" and "trust context" — no "vouch", "attest" or "area" left in its strings', () => {
    const copy = uiStrings(path.join(SRC, 'lib/people-copy.ts')).map((s) => s.text)
    expect(copy.filter((t) => /vouch|attest/i.test(t.replace(/`trusted` in the API/g, '')))).toEqual([])
    expect(copy.filter((t) => /\barea/i.test(t))).toEqual([])
  })

  it('the guards read strings, not code: the word in a string trips them, an identifier never does', () => {
    const probe = path.join(SRC, 'lib/__tests__/user-facing-strings.ts')
    expect(uiStrings(probe).some((s) => /typescript parser/.test(s.text))).toBe(false) // a comment is not a string
    expect(uiStrings(path.join(SRC, 'components/agents/CardAttesterLine.tsx')).some((s) => /VOUCH_SHORT/.test(s.text))).toBe(false)
  })
})

describe('plurals: 0, 1 and 2 people (one helper, lib/plural.ts)', () => {
  it('the people line and its parts', () => {
    expect([people(0), people(1), people(2)]).toEqual(['0 people', '1 person', '2 people'])
    expect([peopleVouch(0), peopleVouch(1), peopleVouch(2)]).toEqual(['0 people trust it', '1 person trusts it', '2 people trust it'])
    expect(peopleLine(1, ['Crypto / Onchain'])).toBe('1 person trusts it for Crypto / Onchain')
    expect(peopleLine(2, ['Social', 'Energy'])).toBe('2 people trust it for 2 trust contexts')
    expect([trustContexts(0), trustContexts(1), trustContexts(2)]).toEqual(['0 trust contexts', '1 trust context', '2 trust contexts'])
    expect(forAreas(['Social'])).toBe('for Social')
    // Nobody: the surfaces say so in words, never "0 people trust it".
    expect(NOBODY_VOUCHES).toBe('Nobody trusts it yet')
  })

  it('the stat row, the landing number, the share post, the evaluator tip', () => {
    expect([STAT_PEOPLE(0), STAT_PEOPLE(1), STAT_PEOPLE(2)]).toEqual(['People who trust it', 'Person who trusts it', 'People who trust it'])
    expect([STAT_AREAS(0), STAT_AREAS(1), STAT_AREAS(2)]).toEqual(['Trust contexts', 'Trust context', 'Trust contexts'])
    expect([0, 1, 2].map((n) => peopleVouchHereParts(n).rest)).toEqual(['people trust agents here', 'person trusts agents here', 'people trust agents here'])
    expect([0, 1, 2].map((n) => `${peopleHereLead(n).lead} ${peopleHereLead(n).rest}`)).toEqual(['0 people trust agents here.', '1 person trusts agents here.', '2 people trust agents here.'])
    expect([0, 1, 2].map((n) => checkShareText('Luda', n))).toEqual([
      'Luda: 0 people trust it on AgentScore. Who trusts your agent?',
      'Luda: 1 person trusts it on AgentScore. Who trusts your agent?',
      'Luda: 2 people trust it on AgentScore. Who trusts your agent?',
    ])
    expect([0, 1, 2].map(evaluatorVouchedTip)).toEqual(['0 people trust this evaluator', '1 person trusts this evaluator', '2 people trust this evaluator'])
  })
})

describe('tier labels: Unverified · Established · Verified on screen, the API values unchanged', () => {
  it('the labels, the rule and the one mapping line', () => {
    expect(TIER_LABEL).toEqual({ unverified: 'Unverified', trusted: 'Established', verified: 'Verified' })
    expect((Object.keys(AGENT_TIER_DISPLAY) as AgentTier[]).map((t) => [t, AGENT_TIER_DISPLAY[t].tier, AGENT_TIER_DISPLAY[t].label]))
      .toEqual([['verified', 'verified', 'Verified'], ['trusted', 'trusted', 'Established'], ['unverified', 'unverified', 'Unverified']])
    expect(ESTABLISHED_MAPPING).toBe('Established (`trusted` in the API): at least 2 people and 0.05 tTRUST')
    // The rule (thesis §6) is unchanged.
    expect(AGENT_TIER_LADDER.trusted).toEqual({ minAttesters: 2, minAttestedWei: 50_000_000_000_000_000n })
    expect(AGENT_TIER_LADDER.verified).toEqual({ minAttesters: 3, minAttestedWei: 100_000_000_000_000_000n })
  })

  it('the mapping line is on the tier "?", /docs, llms.txt, SKILL.md and the thesis §6 note', () => {
    const line = 'Established (`trusted` in the API): at least 2 people and 0.05 tTRUST'
    expect(readFileSync(path.join(SRC, 'lib/people-copy.ts'), 'utf8')).toMatch(/text: `\$\{ESTABLISHED_MAPPING\}\./)
    expect(readFileSync(path.join(SRC, 'app/docs/page.tsx'), 'utf8')).toMatch(/\{ESTABLISHED_MAPPING\}/)
    expect(readFileSync(path.join(SRC, 'app/llms.txt/route.ts'), 'utf8')).toContain('Established (\\`trusted\\` in the API): at least 2 people and 0.05 tTRUST.')
    expect(readFileSync(path.join(SRC, '..', 'SKILL.md'), 'utf8')).toContain(line)
    expect(readFileSync(path.join(SRC, '..', 'docs/AGENTSCORE_CORE_THESIS.md'), 'utf8')).toContain(line)
  })
})

describe('API contract — every REST/MCP field name and enum value unchanged (only prose changed)', () => {
  const DACKIE = '0x45078ae569def2264355f77e592028dd6f1f5d6373c204fe82bf3141ab1861fb'
  const attested = aggregateAttestations([{
    tripleId: '0xe8565630aee28d221ca6e33461ca76faaa2e20e8865b0e9be2fbd8875186f906', agentId: DACKIE, agentName: 'Captain Dackie',
    domainTermId: '0xecc2b1dce5f8269777d9001faa532642691d7038eed3c639f04895ac5b312d42',
    supportPositions: [{ wallet: '0x139219107C1eBE569f543C581b3B807Cf6740006', shares: 9_900_000_000_000_000n }], opposePositions: [],
  }])
  const meta = { dataAgeSeconds: 0, dataReadAt: '2026-11-15T00:00:00.000Z' }

  it('the gate answer: decision, reason, tier, peopleVouching, areas[{ area, people, tTrust }], policy, meta', () => {
    const byPeople = parseGatePolicy({ minPeople: '1', area: 'Crypto / Onchain' })
    const byTier = parseGatePolicy({ minTier: 'trusted' })
    if (!byPeople.ok || !byTier.ok) throw new Error('policy')
    const a = decideTrustGate({ status: 'found', attested }, byPeople.policy, meta)
    expect(Object.keys(a).sort()).toEqual(['areas', 'decision', 'meta', 'peopleVouching', 'policy', 'reason', 'tier'])
    expect(Object.keys(a.areas![0]).sort()).toEqual(['area', 'people', 'tTrust'])
    expect(a).toMatchObject({ decision: 'allow', tier: 'unverified', peopleVouching: 1, policy: { minPeople: 1, area: 'Crypto / Onchain' } })
    expect(byTier.policy).toEqual({ minTier: 'trusted' })
    expect(decideTrustGate({ status: 'found', attested }, byTier.policy, meta)).toMatchObject({ decision: 'deny', tier: 'unverified', policy: { minTier: 'trusted' } })
    expect(parseGatePolicy({})).toEqual({ ok: true, policy: { minTier: 'trusted' } }) // the default
    expect(parseGatePolicy({ minTier: 'established' }).ok).toBe(false) // the label is never an API value
  })

  it('enum values: tiers, tier basis, sort id, gate areas', () => {
    expect(Object.keys(AGENT_TIER_DISPLAY).sort()).toEqual(['trusted', 'unverified', 'verified'])
    expect(AGENT_TIER_BASIS).toBe('attestations')
    expect(DEFAULT_SORT).toBe('vouched')
    expect(SORT_OPTIONS.map((o) => o.id)).toEqual(['vouched', 'newest', 'backing'])
    expect(GATE_AREAS).toContain('Crypto / Onchain')
  })

  it('MCP: the same twelve tool names; should_i_trust takes agentId, minTier ("trusted" | "verified"), minPeople, area', () => {
    const mcp = readFileSync(path.join(SRC, 'app/api/mcp/[transport]/route.ts'), 'utf8')
    expect([...mcp.matchAll(/registerTool\(\s*'([a-z_]+)'/g)].map((m) => m[1])).toEqual([
      'search_agents', 'get_agent_trust', 'get_domain_ranking', 'list_domains', 'trust_query', 'get_evaluator',
      'top_evaluators', 'compare_agents', 'register_agent', 'platform_stats', 'get_agent_timeline', 'should_i_trust',
    ])
    const gate = mcp.slice(mcp.indexOf("'should_i_trust'"))
    expect(gate).toMatch(/agentId: z\.string\(\)/)
    expect(gate).toMatch(/minTier: z\.enum\(\['trusted', 'verified'\]\)\.optional\(\)/)
    expect(gate).toMatch(/minPeople: z\.number\(\)\.int\(\)\.min\(1\)\.optional\(\)/)
    expect(gate).toMatch(/area: z\.enum\(GATE_AREAS as \[string, \.\.\.string\[\]\]\)\.optional\(\)/)
    expect(gate).toMatch(/async \(\{ agentId, minTier, minPeople, area \}\)/)
  })

  it('REST: the gate reads minTier, minPeople and area; the agent fields keep trustTier / tierBasis; stats keep attesters', () => {
    expect(readFileSync(path.join(SRC, 'app/api/v1/agents/[id]/gate/route.ts'), 'utf8'))
      .toMatch(/parseGatePolicy\(\{ minTier: q\.get\('minTier'\), minPeople: q\.get\('minPeople'\), area: q\.get\('area'\) \}\)/)
    const api = readFileSync(path.join(SRC, 'lib/api-data.ts'), 'utf8')
    expect(api).toMatch(/\btrustTier: AgentTier \| null/)
    expect(api).toMatch(/\btierBasis: AgentTierBasis/)
    expect(api).toMatch(/\n\s+attesters,\n/) // getPlatformStats' field
  })
})
