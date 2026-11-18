/**
 * Etap 9 commit 1 — the AgentScore list shows agents. Three odd entries, measured on the live
 * testnet indexer and production on 2026-11-18:
 *
 * 1. "json object" (0x4547b953…): a JsonObject atom. Hasura's `label` is the literal "json object";
 *    the name ("CodeBuddy") lives in `atom.data`. Already read correctly (effectiveLabel →
 *    getAtomName): production answered `name: "CodeBuddy"`. 2 stakers, 0.099 tTRUST — a real
 *    registration, never filtered. Locked here.
 * 2. "Skill: On-Chain Data Analyzer …" (0xf9508a10…): a skill atom, created 2026-03-04 beside four
 *    other "Skill:" atoms, listed as an agent only because someone put a trust triple on it. Its one
 *    position is redeemed to 0. Fixed by classification (agent-junk-filter.ts 'skill_atom').
 * 3. OPEN CLAW (0x0d579846…): a real agent with a real backer. REST and MCP named it with its
 *    whole description ("OPEN CLAW from Kryptoremontier - OPEN CLAW from Kryptoremontier for
 *    Testing AgentScore.") because api-data.ts had a second label parser. One parser now.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { classifyAgentJunk, filterAgents, type JunkCandidate } from '../agent-junk-filter'
import { effectiveLabel } from '../api-data'
import { cleanAtomName } from '@/types/claim'

// Raw rows as the indexer returned them (label, data).
const ROWS = {
  luda: { id: '0x82d87d9517b68e653418c0e49805b36aca3e33a00536af25fc319f5c24802c5a', label: 'Luda', data: '{"@context":"https://schema.org","@type":"Thing","name":"Luda","description":"AI watch for ludarep"}' },
  openClaw: { id: '0x0d579846f2c0f7d3d3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f80910', label: 'Agent: OPEN CLAW from Kryptoremontier - OPEN CLAW from Kryptoremontier for Testing AgentScore.', data: 'Agent: OPEN CLAW from Kryptoremontier - OPEN CLAW from Kryptoremontier for Testing AgentScore.' },
  codeBuddy: { id: '0x4547b953c70000000000000000000000000000000000000000000000000000aa', label: 'json object', data: '{"name":"CodeBuddy","description":"Suggest buddy for coding explanation.","category":"data-analysis"}' },
  talaria: { id: '0xac7682d94100000000000000000000000000000000000000000000000000bb', label: 'Agent:INTU:Talaria', data: 'Agent:INTU:Talaria' },
  codeHelper: { id: '0x60b8fa47d700000000000000000000000000000000000000000000000000cc', label: 'Agent:INTU: Code Helper AI - First On-Chain with Full reputaiton and identity Helper AI for Coding systems.', data: null },
  skill: { id: '0xf9508a1016e22fb67a540fefed118b3128dc1c6a56efe8e1f3f409a666f426ec', label: 'Skill: On-Chain Data Analyzer - Description\tReads and interprets blockchain transaction data, wallet balances and smart contract states.', data: null },
} as const

const cand = (r: { id: string; label: string; data: string | null }, stakers = 1, stake = 0.01): JunkCandidate<string> =>
  ({ termId: r.id, label: effectiveLabel(r), stakerCount: stakers, totalStake: stake, createdAt: '2026-03-01T00:00:00Z', original: r.id })

describe('a skill atom is not an agent', () => {
  it('the "Skill:" type marker classifies it — counted as hidden, never silently dropped', () => {
    expect(classifyAgentJunk({ termId: ROWS.skill.id, label: effectiveLabel(ROWS.skill) })).toBe('skill_atom')
    expect(classifyAgentJunk({ termId: '0xnew', label: 'Skill:INTU: Web Search Tool - Best Web Search Tool' })).toBe('skill_atom')
    const { kept, junk } = filterAgents([cand(ROWS.luda), cand(ROWS.skill, 0, 0)])
    expect(kept).toEqual([ROWS.luda.id])
    expect(junk).toEqual([{ item: ROWS.skill.id, reason: 'skill_atom' }])
  })
  it('only the marker at the start of the label: an agent that mentions skills stays an agent', () => {
    expect(classifyAgentJunk({ termId: '0xa', label: 'Agent: Skill Finder - finds skills' })).toBeNull()
    expect(classifyAgentJunk({ termId: '0xb', label: 'Skillful Trader' })).toBeNull()
    expect(classifyAgentJunk({ termId: '0xc', label: '{"name":"Skill: not a marker, a JSON name"}' })).toBeNull()
  })
})

describe('real agents are never filtered, whatever their raw label looks like', () => {
  it('Luda, OPEN CLAW, CodeBuddy ("json object"), Talaria and Code Helper AI all pass', () => {
    for (const r of [ROWS.luda, ROWS.openClaw, ROWS.codeBuddy, ROWS.talaria, ROWS.codeHelper]) {
      expect(classifyAgentJunk({ termId: r.id, label: effectiveLabel(r) }), r.label).toBeNull()
    }
    const all = [ROWS.luda, ROWS.openClaw, ROWS.codeBuddy, ROWS.talaria, ROWS.codeHelper].map((r) => cand(r))
    expect(filterAgents(all).kept).toHaveLength(5)
  })
})

describe('one name parser for the screen, REST and MCP', () => {
  it('a JSON atom\'s name comes from atom.data ("json object" is Hasura\'s label, not a name)', () => {
    expect(effectiveLabel(ROWS.codeBuddy)).toBe(ROWS.codeBuddy.data)
    expect(cleanAtomName(effectiveLabel(ROWS.codeBuddy))).toBe('CodeBuddy')
    expect(cleanAtomName(effectiveLabel(ROWS.luda))).toBe('Luda')
  })
  it('legacy labels: both wrappers stripped, the description after " - " is not the name', () => {
    expect(cleanAtomName(effectiveLabel(ROWS.openClaw))).toBe('OPEN CLAW from Kryptoremontier')
    expect(cleanAtomName(effectiveLabel(ROWS.talaria))).toBe('Talaria')
    expect(cleanAtomName(effectiveLabel(ROWS.codeHelper))).toBe('Code Helper AI')
  })
  it('api-data names agents with that parser everywhere it names one (source guard)', () => {
    const src = readFileSync(path.join(__dirname, '..', 'api-data.ts'), 'utf8')
    expect(src).toMatch(/const agentNameOf = cleanAtomName/)
    expect(src).toMatch(/name: agentNameOf\(effLabel\)/)
    expect(src).toMatch(/agentName: agentNameOf\(effectiveLabel\(row\)\)/)
    expect(src).toMatch(/agentName: t\.subject\?\.label \? agentNameOf\(t\.subject\.label\)/)
    expect(src).not.toMatch(/name: cleanLabel\(effLabel\)/)
  })
})
