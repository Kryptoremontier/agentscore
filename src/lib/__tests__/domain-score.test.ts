import { describe, it, expect } from 'vitest'
import { scoreDomains, DISTINCT_ATTESTER_WEIGHT, REPEAT_ATTESTATION_WEIGHT, type CategoryAttestation } from '../domain-score'

const A = (category: string, attester: string): CategoryAttestation => ({ category, attester })

describe('scoreDomains — alias folding', () => {
  it('folds defi + crypto_assets + "Crypto / Onchain" into ONE Crypto/Onchain bucket', () => {
    const res = scoreDomains([
      A('defi', '0xaaa'),
      A('crypto_assets', '0xbbb'),
      A('Crypto / Onchain', '0xccc'),
    ])
    expect(Object.keys(res.vector)).toEqual(['Crypto / Onchain'])
    const c = res.vector['Crypto / Onchain']
    expect(c.count).toBe(3)
    expect(c.distinctAttesters).toBe(3)
    expect(c.status).toBe('canonical')
    expect(c.termId).toBe('0xecc2b1dce5f8269777d9001faa532642691d7038eed3c639f04895ac5b312d42')
    // sources surface the fragmentation that was folded
    expect(c.sources).toEqual(['Crypto / Onchain', 'crypto_assets', 'defi'])
  })

  it('is case-insensitive (DEFI / DeFi → Crypto / Onchain)', () => {
    const res = scoreDomains([A('DEFI', '0xa'), A('DeFi', '0xb')])
    expect(Object.keys(res.vector)).toEqual(['Crypto / Onchain'])
    expect(res.vector['Crypto / Onchain'].count).toBe(2)
  })

  it('passes through a Title-Case canonical label with its term_id', () => {
    const res = scoreDomains([A('Social', '0xa')])
    expect(res.vector['Social'].status).toBe('canonical')
    expect(res.vector['Social'].termId).toBe('0x9c7db27885e2e35f9a2f674943f61b02f321ea22d91dd48dea6d82647f884a91')
  })
})

describe('scoreDomains — diversity-weighted score', () => {
  it('rewards distinct attesters over repeats', () => {
    const distinct = scoreDomains([A('defi', '0xa'), A('defi', '0xb')]).vector['Crypto / Onchain']
    const repeated = scoreDomains([A('defi', '0xa'), A('defi', '0xa')]).vector['Crypto / Onchain']
    // 2 distinct → 2*10 + 0 = 20 ; 1 distinct + 1 repeat → 1*10 + 1*1 = 11
    expect(distinct.score).toBe(2 * DISTINCT_ATTESTER_WEIGHT)
    expect(repeated.score).toBe(1 * DISTINCT_ATTESTER_WEIGHT + 1 * REPEAT_ATTESTATION_WEIGHT)
    expect(distinct.score).toBeGreaterThan(repeated.score)
  })

  it('treats attester case-insensitively when counting distinctness', () => {
    const res = scoreDomains([A('defi', '0xABC'), A('defi', '0xabc')])
    expect(res.vector['Crypto / Onchain'].distinctAttesters).toBe(1)
  })
})

describe('scoreDomains — taxonomy gaps surfaced', () => {
  it('marks uncovered domains PENDING_CANONICAL (null term_id) and surfaces the labels', () => {
    const res = scoreDomains([A('agriculture', '0xa'), A('crop_management', '0xb')])
    const ag = res.vector['Agriculture']
    expect(ag.status).toBe('pending_canonical')
    expect(ag.termId).toBeNull()
    expect(ag.count).toBe(2)
    expect(res.pendingCanonical).toEqual(['agriculture', 'crop_management'])
  })

  it('routes unknown labels to Uncategorized and surfaces them (never dropped)', () => {
    const res = scoreDomains([A('quantum_basketweaving', '0xa'), A('defi', '0xb')])
    expect(res.vector['Uncategorized'].status).toBe('uncategorized')
    expect(res.vector['Uncategorized'].count).toBe(1)
    expect(res.uncategorized).toEqual(['quantum_basketweaving'])
    // the known label still scores normally alongside
    expect(res.vector['Crypto / Onchain'].count).toBe(1)
  })
})

describe('scoreDomains — edge cases', () => {
  it('returns an empty result for empty input', () => {
    const res = scoreDomains([])
    expect(res.vector).toEqual({})
    expect(res.totalAttestations).toBe(0)
    expect(res.uncategorized).toEqual([])
    expect(res.pendingCanonical).toEqual([])
  })

  it('skips malformed rows but counts valid ones', () => {
    // @ts-expect-error — intentionally malformed row to test resilience
    const res = scoreDomains([A('defi', '0xa'), { attester: '0xb' }, null])
    expect(res.totalAttestations).toBe(1)
    expect(res.vector['Crypto / Onchain'].count).toBe(1)
  })

  it('counts attestations with a missing attester as volume, not diversity', () => {
    const res = scoreDomains([A('defi', ''), A('defi', '')])
    const c = res.vector['Crypto / Onchain']
    expect(c.count).toBe(2)
    expect(c.distinctAttesters).toBe(0)
    // 0 distinct + 2 repeats → 0*10 + 2*1 = 2
    expect(c.score).toBe(2 * REPEAT_ATTESTATION_WEIGHT)
  })
})
