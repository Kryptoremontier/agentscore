import { describe, it, expect } from 'vitest'
import { calculateTier } from '../trust-tiers'

/**
 * calculateTier is the vault ladder that skills, claims, IntuForge projects and
 * My Agents still use. Agent tiers no longer go through it (thesis §6 — they
 * come only from attestations: lib/agent-tier.ts, tested in agent-tier.test.ts);
 * the list card's measuredTier was removed with that change.
 */

describe('calculateTier at zero stake — the ratio is never consulted', () => {
  it('returns Unverified for every ratio 0..100 (and NaN): each higher tier needs minTotalStake > 0', () => {
    for (let ratio = 0; ratio <= 100; ratio++) {
      expect(calculateTier(50, 0, ratio, 400).tier).toBe('unverified')
    }
    expect(calculateTier(50, 0, Number.NaN, 400).tier).toBe('unverified')
  })
})
