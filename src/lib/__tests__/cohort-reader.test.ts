import { describe, it, expect } from 'vitest'
import { isErc8004Caip, foldClassificationBySubject, type ClassificationRow } from '../cohort-reader'

describe('isErc8004Caip — CAIP pattern filter', () => {
  it('matches a real ERC-8004 CAIP identity label (Base)', () => {
    expect(isErc8004Caip('eip155:8453/erc721:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432/16850')).toBe(true)
  })

  it('matches case-insensitively (checksummed vs lowercase contract address)', () => {
    expect(isErc8004Caip('eip155:56/erc721:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432/2379')).toBe(true)
  })

  it('rejects an unrelated same-as target (e.g. an X/Twitter identity link)', () => {
    expect(isErc8004Caip('https://x.com/someagent')).toBe(false)
  })

  it('rejects a CAIP identity for a different contract', () => {
    expect(isErc8004Caip('eip155:8453/erc721:0x1234567890abcdef1234567890abcdef12345678/1')).toBe(false)
  })

  it('handles null/undefined/empty without throwing', () => {
    expect(isErc8004Caip(null)).toBe(false)
    expect(isErc8004Caip(undefined)).toBe(false)
    expect(isErc8004Caip('')).toBe(false)
  })
})

describe('foldClassificationBySubject — dual-resolution over cohort classification edges', () => {
  const row = (subject: string, id: string, label: string): ClassificationRow => ({
    subject_id: subject,
    object: { term_id: id, label },
  })

  it('groups labels per subject', () => {
    const result = foldClassificationBySubject([
      row('agent-1', '0xa', 'defi'),
      row('agent-1', '0xb', 'trading'),
      row('agent-2', '0xc', 'agriculture'),
    ])
    expect(result.get('agent-1')).toEqual(['defi', 'trading'])
    expect(result.get('agent-2')).toEqual(['agriculture'])
  })

  it('folds duplicate-atom-same-label edges onto one label per subject (no visual duplicate chip)', () => {
    // Same subject declares "technology/blockchain" via both duplicate atoms
    // observed live — must render as ONE chip, not two.
    const result = foldClassificationBySubject([
      row('agent-1', '0xa8437e51', 'technology/blockchain'),
      row('agent-1', '0x8e9153c1', 'technology/blockchain'),
    ])
    expect(result.get('agent-1')).toEqual(['technology/blockchain'])
  })

  it('dedups a subject that declares the SAME label twice via different duplicate atoms across two subjects consistently', () => {
    const result = foldClassificationBySubject([
      row('agent-1', '0xa', 'reputation'),
      row('agent-2', '0xb', 'reputation'), // duplicate atom of "reputation", different id
    ])
    // Both should fold to the same representative label string.
    expect(result.get('agent-1')).toEqual(['reputation'])
    expect(result.get('agent-2')).toEqual(['reputation'])
  })

  it('returns sorted labels for stable chip ordering', () => {
    const result = foldClassificationBySubject([
      row('agent-1', '0xa', 'trading'),
      row('agent-1', '0xb', 'agriculture'),
      row('agent-1', '0xc', 'blockchain'),
    ])
    expect(result.get('agent-1')).toEqual(['agriculture', 'blockchain', 'trading'])
  })

  it('skips rows with missing subject or object label', () => {
    const result = foldClassificationBySubject([
      { subject_id: '', object: { term_id: '0xa', label: 'defi' } },
      { subject_id: 'agent-1', object: { term_id: '0xb', label: '' } },
    ] as ClassificationRow[])
    expect(result.size).toBe(0)
  })

  it('returns an empty map for no edges', () => {
    expect(foldClassificationBySubject([]).size).toBe(0)
  })
})
