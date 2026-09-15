import { describe, it, expect } from 'vitest'
import { classifyAgentJunk, filterAgents, filterForgeProjects, type JunkCandidate } from '../agent-junk-filter'

// Real prod term_ids (verified live 2026-09-06, see file header of agent-junk-filter.ts).
const SCHEMA_TEST_003 = '0x999e5bb71e149b98694dd49e9a0aaf172a10de428664d80244792d61234a00e4'
const SCHEMA_TEST_002 = '0x4cc998ef5da452cd773f7054066fc1ca2567d10b45b34a726bcddbc578dd89f3'
const SCHEMA_TEST_001 = '0xe7aec6efa6f9056eac7fc1855ae4fe0b260a5546b4ea1f5ea8a3ab9e4f2779d4'
const XYZ_ID = '0x5cf62914ed17eea568b9e30c4df714d45c6e81e3390f8e64db45af279348bf90'
const TRUST_TEST_ALPHA = '0x69eb97b10f25457dd6b6a410d5ca52f6afd975e9d621261d9f1bcd55b7ddf586'

const CODE_HELPER_INTU = '0x60b8fa47d7165f07a475321a86a16f8e00e7d65c743647f6baa27f70f63df025'
const CODE_HELPER_PLAIN = '0xfd05c1f7bc1ebf0100d8e8d0a1e69489982ff373ed7a51440983bb4b1a283fd7'

const LUDA_ID = '0x82d87d9517b68e653418c0e49805b36aca3e33a00536af25fc319f5c24802c5a'
const OPEN_CLAW_ID = '0x0d579846f21a66f35efafb2339d182e27560ec9f9d8ea64f7f1d9929d20a2d7d'

function cand<T extends string>(termId: string, label: string, stakerCount: number, totalStake: number, createdAt = '2026-01-01T00:00:00Z'): JunkCandidate<T> {
  return { termId, label: label as T, stakerCount, totalStake, createdAt, original: label as T }
}

describe('classifyAgentJunk — blocklist', () => {
  it.each([
    [SCHEMA_TEST_003, 'SchemaTest-003'],
    [SCHEMA_TEST_002, 'SchemaTest-002'],
    [SCHEMA_TEST_001, 'SchemaTest-001'],
    [XYZ_ID, 'XYZ'],
    [TRUST_TEST_ALPHA, 'Trust Test Agent Alpha - Trust Test Agent Alpha from MCP Server.'],
  ])('flags blocklisted id %s as blocklisted_id', (id, label) => {
    expect(classifyAgentJunk({ termId: id, label })).toBe('blocklisted_id')
  })

  it('is case-insensitive on the term_id', () => {
    expect(classifyAgentJunk({ termId: SCHEMA_TEST_003.toUpperCase(), label: 'SchemaTest-003' })).toBe('blocklisted_id')
  })
})

describe('classifyAgentJunk — regex second net', () => {
  it('flags an unblocklisted SchemaTest-* by pattern', () => {
    expect(classifyAgentJunk({ termId: '0xnew', label: 'SchemaTest-999' })).toBe('test_fixture')
  })
  it('flags an unblocklisted "Trust Test Agent" by pattern', () => {
    expect(classifyAgentJunk({ termId: '0xnew', label: 'Trust Test Agent Beta' })).toBe('test_fixture')
  })
  it('does NOT flag a bare "XYZ" label with a different, non-blocklisted id — a real agent may be named that', () => {
    expect(classifyAgentJunk({ termId: '0xsomeRealAgent', label: 'XYZ' })).toBeNull()
  })
  it('kept via filterAgents when "XYZ" label appears on a non-blocklisted id', () => {
    const { kept, junk } = filterAgents([cand('0xrealxyz', 'XYZ', 5, 1, '2026-01-01T00:00:00Z')])
    expect(kept).toEqual(['XYZ'])
    expect(junk).toEqual([])
  })
})

describe('filterAgents — Code Helper AI: the atom WITH more distinct stakers wins, regardless of raw stake or which id/label carries it', () => {
  it('order A: INTU-prefixed atom has the stake and stakers -> kept; plain-named atom folded', () => {
    const candidates = [
      cand(CODE_HELPER_INTU, 'INTU: Code Helper AI - First On-Chain with Full reputaiton and identity Helper AI for Coding systems.', 3, 0.2249),
      cand(CODE_HELPER_PLAIN, 'Code Helper AI - The best Claude Code Helper AI on Intuition !', 2, 0.3322),
    ]
    const { kept, junk } = filterAgents(candidates)
    expect(kept).toEqual([candidates[0]!.original])
    expect(junk).toEqual([{ item: candidates[1]!.original, reason: 'folded_duplicate' }])
  })

  it('order B: reversed input order and reversed which atom carries the higher stake — the 3-staker atom STILL wins', () => {
    // Same real-world facts as order A, but fed in reverse and with the
    // stake numbers swapped, to prove the decision follows staker count,
    // not array position or which id happens to have more raw stake.
    const candidates = [
      cand(CODE_HELPER_PLAIN, 'Code Helper AI - The best Claude Code Helper AI on Intuition !', 2, 5.0),
      cand(CODE_HELPER_INTU, 'INTU: Code Helper AI - First On-Chain with Full reputaiton and identity Helper AI for Coding systems.', 3, 0.01),
    ]
    const { kept, junk } = filterAgents(candidates)
    expect(kept).toEqual([candidates[1]!.original]) // the 3-staker one, despite far less stake
    expect(junk).toEqual([{ item: candidates[0]!.original, reason: 'folded_duplicate' }])
  })
})

describe('filterAgents — tie-break order: stakers beats stake', () => {
  it('atom with more distinct stakers wins even with far less raw stake', () => {
    const a = cand('0xA', 'Same Name', 1, 5)
    const b = cand('0xB', 'Same Name', 3, 0.3)
    const { kept, junk } = filterAgents([a, b])
    expect(kept).toEqual([b.original])
    expect(junk).toEqual([{ item: a.original, reason: 'folded_duplicate' }])
  })

  it('falls through to stake when staker counts tie', () => {
    const a = cand('0xA', 'Same Name', 1, 0.01)
    const b = cand('0xB', 'Same Name', 1, 5)
    const { kept } = filterAgents([a, b])
    expect(kept).toEqual([b.original])
  })

  it('falls through to oldest when stakers and stake both tie', () => {
    const a = cand('0xA', 'Same Name', 1, 1, '2026-03-01T00:00:00Z')
    const b = cand('0xB', 'Same Name', 1, 1, '2026-01-01T00:00:00Z') // older
    const { kept } = filterAgents([a, b])
    expect(kept).toEqual([b.original])
  })
})

describe('filterAgents — normalization needed for the real Code Helper AI pair', () => {
  it('strips the INTU: prefix AND the "Name - description" tail before comparing', () => {
    const a = cand('0xA', 'INTU: Foo Bar - some long description here', 1, 1)
    const b = cand('0xB', 'Foo Bar - a totally different description', 1, 1)
    const { kept, junk } = filterAgents([a, b])
    expect(kept).toHaveLength(1)
    expect(junk).toHaveLength(1)
  })
})

describe('normalizeAgentLabel — RAW atom.label, no caller pre-cleaning required', () => {
  // Both fetch paths (api-data.ts, agents/page.tsx) now pass effectiveLabel(row)
  // straight through, unmodified. This module owns ALL cleaning for
  // fold-matching — see the file-header "Label input contract" note. A caller
  // reverting to a pre-cleaned display name (the 2026-09-06 regression) must
  // still fold correctly against a raw label, which this test guards.
  it('a real raw "Agent:INTU:..." label and an already-clean plain name normalize to the same key', () => {
    const rawIntu = cand(
      CODE_HELPER_INTU,
      'Agent:INTU: Code Helper AI - First On-Chain with Full reputaiton and identity Helper AI for Coding systems.',
      3,
      0.2249,
    )
    const plainClean = cand(CODE_HELPER_PLAIN, 'Code Helper AI', 1, 0.01)
    const { kept, junk } = filterAgents([rawIntu, plainClean])
    expect(kept).toEqual([rawIntu.original])
    expect(junk).toEqual([{ item: plainClean.original, reason: 'folded_duplicate' }])
  })

  it('a raw "Agent: ..." label (no INTU: layer) also normalizes to the same key as the plain name', () => {
    const rawAgent = cand('0xA', 'Agent: Code Helper AI - The best Claude Code Helper AI on Intuition !', 2, 0.3322)
    const plainClean = cand('0xB', 'Code Helper AI', 1, 0.01)
    const { kept, junk } = filterAgents([rawAgent, plainClean])
    expect(kept).toEqual([rawAgent.original])
    expect(junk).toEqual([{ item: plainClean.original, reason: 'folded_duplicate' }])
  })
})

describe('filterForgeProjects — "Agent Score" cluster: all tied on stakers, stake decides', () => {
  it('6 variants -> 1 kept (highest stake, V1.0), 5 folded; Talaria untouched; counts sum to input length', () => {
    const candidates = [
      cand('0xV10', 'Agent Score V1.0', 1, 0.31458, '2026-04-06T21:22:23Z'),
      cand('0xV12', 'Agent Score V1.2', 1, 0.04998, '2026-04-12T16:56:16Z'),
      cand('0xV1',  'Agent Score V1',   1, 0.00098, '2026-04-06T16:24:13Z'),
      cand('0xAS1', 'Agent Score',      1, 0.00098, '2026-04-06T15:56:28Z'),
      cand('0xAS2', 'Agent Score',      1, 0.00098, '2026-04-06T15:42:32Z'),
      cand('0xAS3', 'Agent Score',      1, 0.00098, '2026-04-06T11:12:53Z'),
      cand('0xTAL', 'Talaria',          2, 0.05978, '2026-04-23T22:05:45Z'),
    ]
    const { kept, junk } = filterForgeProjects(candidates)
    expect(kept.sort()).toEqual(['Agent Score V1.0', 'Talaria'].sort())
    expect(junk).toHaveLength(5)
    expect(junk.every((j) => j.reason === 'folded_duplicate')).toBe(true)
    expect(kept.length + junk.length).toBe(candidates.length)
  })

  it('normalizes "V1.0"/"V1.2"/"V1" and bare "Agent Score" to the same key; "Talaria" is a distinct key', () => {
    const candidates = [
      cand('0xV10', 'Agent Score V1.0', 1, 1),
      cand('0xTAL', 'Talaria', 1, 1),
    ]
    const { kept } = filterForgeProjects(candidates)
    expect(kept.sort()).toEqual(['Agent Score V1.0', 'Talaria'].sort())
  })
})

describe('HARD GUARANTEE — Luda and OPEN CLAW always pass through untouched', () => {
  // Real prod facts (verified live 2026-09-06): Luda carries the first
  // attestation in the protocol's history (2026-07-11, Knowledge/Productivity).
  // OPEN CLAW is a real registered agent with a real backer (0.335061 tTRUST).
  // Neither is a duplicate of anything, neither matches any blocklist/regex.
  const luda = cand(LUDA_ID, 'Luda', 1, 0.00098, '2026-06-01T00:00:00Z')
  const openClaw = cand(OPEN_CLAW_ID, 'OPEN CLAW from Kryptoremontier - OPEN CLAW from Kryptoremontier for Testing AgentScore.', 1, 0.335061, '2026-02-18T15:47:00Z')

  it('classifyAgentJunk never flags either', () => {
    expect(classifyAgentJunk({ termId: LUDA_ID, label: 'Luda' })).toBeNull()
    expect(classifyAgentJunk({ termId: OPEN_CLAW_ID, label: openClaw.label })).toBeNull()
  })

  it('filterAgents keeps both, alongside unrelated real agents, junk contains neither', () => {
    const { kept, junk } = filterAgents([
      luda,
      openClaw,
      cand(SCHEMA_TEST_001, 'SchemaTest-001', 1, 0.00098),
      cand(CODE_HELPER_INTU, 'INTU: Code Helper AI - First On-Chain...', 3, 0.2249),
      cand(CODE_HELPER_PLAIN, 'Code Helper AI - The best...', 2, 0.3322),
    ])
    expect(kept).toContain(luda.original)
    expect(kept).toContain(openClaw.original)
    expect(junk.some((j) => j.item === luda.original)).toBe(false)
    expect(junk.some((j) => j.item === openClaw.original)).toBe(false)
  })
})
