import { describe, it, expect } from 'vitest'
import {
  mapSkillToBucket,
  refineSkillTriples,
  SKILL_DOMAIN_BUCKETS,
  UNCATEGORIZED,
} from '../skill-domain-map'
import { classifyJunk } from '../skill-junk-filter'
import type { DomainTripleData } from '../domain-scoring'

const T = (skillName: string, skillId: string, agentId = '0xagent1'): DomainTripleData => ({
  tripleId: `triple-${skillId}-${agentId}`,
  agentId,
  agentName: 'Agent',
  skillId,
  skillName,
  supportShares: 0n,
  opposeShares: 0n,
  supportPositionCount: 0,
  opposePositionCount: 0,
})

describe('mapSkillToBucket — bucket mapping', () => {
  it('maps a seeded skill to its canonical bucket with the reusable term_id', () => {
    const m = mapSkillToBucket('HODL')
    expect(m.bucket).toBe('Crypto / Onchain')
    expect(m.status).toBe('canonical')
    expect(m.termId).toBe('0xecc2b1dce5f8269777d9001faa532642691d7038eed3c639f04895ac5b312d42')
  })

  it('is trim + case-insensitive (philosophy / Philosophy / " TYPESCRIPT ")', () => {
    expect(mapSkillToBucket('philosophy').bucket).toBe('Knowledge / Productivity')
    expect(mapSkillToBucket('Philosophy').bucket).toBe('Knowledge / Productivity')
    expect(mapSkillToBucket(' TYPESCRIPT ').bucket).toBe('AI / Coding')
  })

  it('passes bucket labels through (skill "Social" → bucket Social)', () => {
    const m = mapSkillToBucket('Social')
    expect(m.bucket).toBe('Social')
    expect(m.status).toBe('canonical')
  })

  it('maps the Design cluster to the PENDING_CANONICAL "Design / Creative" bucket (null term_id)', () => {
    for (const label of ['Design', 'Graphic Design', 'UX', 'Figma', 'Sound Design']) {
      const m = mapSkillToBucket(label)
      expect(m.bucket).toBe('Design / Creative')
      expect(m.status).toBe('pending_canonical')
      expect(m.termId).toBeNull()
    }
    expect(SKILL_DOMAIN_BUCKETS.some(b => b.label === 'Design / Creative')).toBe(true)
  })

  it('routes unknown labels to Uncategorized (never dropped)', () => {
    const m = mapSkillToBucket('Quantum Basketweaving')
    expect(m.bucket).toBe(UNCATEGORIZED)
    expect(m.status).toBe('uncategorized')
    expect(m.termId).toBeNull()
  })
})

describe('classifyJunk — transitional junk filter', () => {
  it('flags account handles (.eth names and 0x hex identifiers)', () => {
    expect(classifyJunk('intuitionbilly.eth')).toBe('account_handle')
    expect(classifyJunk('web3npc.eth')).toBe('account_handle')
    expect(classifyJunk('0x2f76eF07Df7b3904c1350e24Ad192e507fd4ec41')).toBe('account_handle')
  })

  it('flags leaked predicate labels (exact, case-insensitive)', () => {
    expect(classifyJunk('has tag')).toBe('predicate_label')
    expect(classifyJunk('Is Skilled In')).toBe('predicate_label')
    expect(classifyJunk('belongs to')).toBe('predicate_label')
  })

  it('flags vanity labels from the blocklist', () => {
    expect(classifyJunk('Flamebearer')).toBe('vanity')
    expect(classifyJunk('LOCKED IN')).toBe('vanity')
    expect(classifyJunk('Web3 Thought Leader')).toBe('vanity')
    expect(classifyJunk('A developer')).toBe('vanity')
  })

  it('passes real skills through', () => {
    expect(classifyJunk('TypeScript')).toBeNull()
    expect(classifyJunk('Blockchain Technology')).toBeNull()
  })

  it('matches exact labels only — near-misses of blocklist entries pass', () => {
    expect(classifyJunk('Following markets')).toBeNull() // not "follows"
    expect(classifyJunk('Builder Tools')).toBeNull()     // not "builder"
    expect(classifyJunk('has tagging expertise')).toBeNull() // not "has tag"
  })
})

describe('refineSkillTriples — quality/structure pipeline', () => {
  it('drops junk triples and counts them (distinct labels + raw rows)', () => {
    const res = refineSkillTriples([
      T('intuitionbilly.eth', '0xs1'),
      T('intuitionbilly.eth', '0xs1', '0xagent2'),
      T('has tag', '0xs2'),
      T('Flamebearer', '0xs3'),
      T('React', '0xs4'),
    ])
    expect(res.triples).toHaveLength(1)
    expect(res.triples[0].skillName).toBe('React')
    expect(res.junkCount).toBe(3)
    expect(res.junkLabels).toEqual(['Flamebearer', 'has tag', 'intuitionbilly.eth'])
    expect(res.junkTripleCount).toBe(4)
  })

  it('cleans labels BEFORE junk-checking ("Skill:INTU: A developer - …" → vanity)', () => {
    const res = refineSkillTriples([
      T('Skill:INTU: A developer - A smart contract developer', '0xs1'),
    ])
    expect(res.triples).toHaveLength(0)
    expect(res.junkLabels).toEqual(['A developer'])
  })

  it('folds case-duplicates onto one skillId, preferring the uppercase-first label', () => {
    const res = refineSkillTriples([
      T('philosophy', '0xslower'),
      T('Philosophy', '0xsupper', '0xagent2'),
    ])
    expect(res.triples).toHaveLength(2)
    const ids = new Set(res.triples.map(t => t.skillId))
    expect(ids).toEqual(new Set(['0xsupper']))
    expect(res.triples.every(t => t.skillName === 'Philosophy')).toBe(true)
    expect(res.foldedSkillIds.get('0xslower')).toBe('0xsupper')
  })

  it('merges duplicate atoms sharing one label onto the atom with most triples', () => {
    const res = refineSkillTriples([
      T('TypeScript', '0xbig'),
      T('TypeScript', '0xbig', '0xagent2'),
      T('TypeScript', '0xsmall', '0xagent3'),
    ])
    expect(new Set(res.triples.map(t => t.skillId))).toEqual(new Set(['0xbig']))
    expect(res.junkCount).toBe(0)
    // folded id resolves to representative; representative itself is not in the map
    expect(res.foldedSkillIds.get('0xsmall')).toBe('0xbig')
    expect(res.foldedSkillIds.has('0xbig')).toBe(false)
  })

  it('returns an empty result for empty input', () => {
    const res = refineSkillTriples([])
    expect(res.triples).toEqual([])
    expect(res.junkCount).toBe(0)
    expect(res.junkLabels).toEqual([])
    expect(res.junkTripleCount).toBe(0)
    expect(res.foldedSkillIds.size).toBe(0)
  })
})
