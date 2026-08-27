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
    expect(res.attestationTriples).toEqual([])
    expect(res.junkCount).toBe(0)
    expect(res.junkLabels).toEqual([])
    expect(res.junkTripleCount).toBe(0)
    expect(res.foldedSkillIds.size).toBe(0)
  })
})

describe('refineSkillTriples — attestation partition (ETAP 2a)', () => {
  // The Knowledge / Productivity canonical bucket atom (canonical-domains.ts).
  const KNOWLEDGE_BUCKET_ID = '0x8a0e3710014141458ee303a6cc504704ee3da370450d7f5cd5a898186a2f66e4'

  it('partitions bucket-atom triples out of skill rows into attestationTriples', () => {
    const attestation = T('Knowledge / Productivity', KNOWLEDGE_BUCKET_ID, '0xluda')
    const skill = T('React', '0xs4')
    const res = refineSkillTriples([attestation, skill])

    expect(res.triples).toHaveLength(1)
    expect(res.triples[0].skillName).toBe('React')
    expect(res.attestationTriples).toHaveLength(1)
    expect(res.attestationTriples[0]).toBe(attestation)
  })

  it('never renders a bucket atom as a pseudo-skill (not junk-counted, not folded)', () => {
    const res = refineSkillTriples([
      T('Knowledge / Productivity', KNOWLEDGE_BUCKET_ID, '0xluda'),
    ])
    expect(res.triples).toHaveLength(0)
    expect(res.junkCount).toBe(0)
    expect(res.junkTripleCount).toBe(0)
    expect(res.foldedSkillIds.size).toBe(0)
    expect(res.attestationTriples).toHaveLength(1)
  })

  it('matches by term_id, NOT label — a different atom with a bucket-like label stays a skill', () => {
    const res = refineSkillTriples([
      T('Knowledge / Productivity', '0xnot-the-bucket-atom'),
    ])
    expect(res.triples).toHaveLength(1)
    expect(res.attestationTriples).toHaveLength(0)
  })

  it('partitions all 8 canonical bucket atoms', () => {
    const bucketIds = [
      '0xecc2b1dce5f8269777d9001faa532642691d7038eed3c639f04895ac5b312d42', // Crypto / Onchain
      '0x0caa623ae3f31ffaa9bf4e27acd1c25d1f7fe3a141145fd77c82cd21b4f59226', // AI / Coding
      KNOWLEDGE_BUCKET_ID,
      '0x9c7db27885e2e35f9a2f674943f61b02f321ea22d91dd48dea6d82647f884a91', // Social
      '0x4e0095d1e2ecfcdccc5abe6e562c513924fb5cddc35c5974ea45327c842618e6', // Entertainment
      '0x19c043b6065719f719ceb67cbbb6989d41d69ba81c3c5cc43327ed7a4a135c0e', // Agriculture
      '0xbfac4ea93d9ffa5126ee9a13d97e5fad326a8aeeec33c95d6f93e311b8818968', // Energy
      '0xa4f404dee0ff69863e6782150aecf688dc6337659da87a3fa0ff0b3ff5214eaf', // Safety / Identity
    ]
    const res = refineSkillTriples(bucketIds.map((id, i) => T(`Bucket ${i}`, id)))
    expect(res.triples).toHaveLength(0)
    expect(res.attestationTriples).toHaveLength(8)
  })
})
