import { describe, it, expect } from 'vitest'
import { foldDuplicateAtoms } from '../atom-fold'

describe('foldDuplicateAtoms', () => {
  it('picks the atom with the most occurrences as representative', () => {
    const { representatives, foldedIds } = foldDuplicateAtoms([
      { id: '0xAAA', label: 'blockchain' },
      { id: '0xBBB', label: 'blockchain' },
      { id: '0xBBB', label: 'blockchain' },
    ])
    expect(representatives.get('blockchain')).toEqual({ id: '0xBBB', label: 'blockchain' })
    expect(foldedIds.get('0xAAA')).toBe('0xBBB')
    expect(foldedIds.has('0xBBB')).toBe(false)
  })

  it('folds case-variant labels onto one representative', () => {
    const { representatives, foldedIds } = foldDuplicateAtoms([
      { id: '0x1', label: 'DeFi' },
      { id: '0x2', label: 'defi' },
    ])
    expect(representatives.size).toBe(1)
    expect(foldedIds.size).toBe(1)
  })

  it('breaks a tie by preferring an uppercase-first label', () => {
    const { representatives } = foldDuplicateAtoms([
      { id: '0x1', label: 'typescript' },
      { id: '0x2', label: 'TypeScript' },
    ])
    expect(representatives.get('typescript')!.label).toBe('TypeScript')
  })

  it('breaks a same-case tie by lowest term_id (deterministic)', () => {
    const { representatives } = foldDuplicateAtoms([
      { id: '0xzzz', label: 'trading' },
      { id: '0xaaa', label: 'trading' },
    ])
    expect(representatives.get('trading')!.id).toBe('0xaaa')
  })

  it('leaves a unique atom unfolded', () => {
    const { representatives, foldedIds } = foldDuplicateAtoms([
      { id: '0x1', label: 'energy' },
    ])
    expect(representatives.get('energy')).toEqual({ id: '0x1', label: 'energy' })
    expect(foldedIds.size).toBe(0)
  })

  it('skips malformed entries without throwing', () => {
    const { representatives } = foldDuplicateAtoms([
      { id: '', label: 'x' },
      { id: '0x1', label: '' },
      { id: '0x2', label: 'agriculture' },
    ] as never)
    expect(representatives.get('agriculture')).toEqual({ id: '0x2', label: 'agriculture' })
  })
})
