import { describe, it, expect } from 'vitest'
import { stringToHex, type Hex } from 'viem'
import { calculateAtomId } from '@0xintuition/sdk'
import { CANONICAL_DOMAINS_REGISTRY, IS_SKILLED_IN } from '../canonical-domains'

/**
 * Deterministic-mint proof: atom term_id is derived purely from the data
 * bytes, so hash(payload) MUST equal the registry termId for every entry.
 * If any of these fail, create-if-missing on testnet would mint a STRAY atom
 * instead of the canonical one — this suite is the pre-flight check.
 */
describe('canonical-domains registry — payload → term_id determinism', () => {
  it('all 8 bucket payloads hash to their registry term_ids', () => {
    for (const d of CANONICAL_DOMAINS_REGISTRY) {
      const computed = calculateAtomId(stringToHex(d.payload) as Hex)
      expect(computed, d.label).toBe(d.termId)
    }
  })

  it('the is-skilled-in predicate payload hashes to its term_id', () => {
    const computed = calculateAtomId(stringToHex(IS_SKILLED_IN.payload) as Hex)
    expect(computed).toBe(IS_SKILLED_IN.termId)
  })

  it('has exactly 8 buckets with unique term_ids and labels', () => {
    expect(CANONICAL_DOMAINS_REGISTRY).toHaveLength(8)
    expect(new Set(CANONICAL_DOMAINS_REGISTRY.map(d => d.termId)).size).toBe(8)
    expect(new Set(CANONICAL_DOMAINS_REGISTRY.map(d => d.label)).size).toBe(8)
  })
})
