import { describe, test, expect, vi } from 'vitest'
import {
  applyAttestationGate,
  getAttestationConfig,
  ATTESTATION_CONFIG_TESTNET,
  ATTESTATION_CONFIG_MAINNET,
} from '../attestation-gate'

describe('Attestation Gate', () => {

  // ─── applyAttestationGate ─────────────────────────────────────────────────

  test('bad evaluator (0.7x) NOT affected by gate — punishment always applies', () => {
    expect(applyAttestationGate(0.7, false)).toBe(0.7)
    expect(applyAttestationGate(0.7, true)).toBe(0.7)
  })

  test('neutral evaluator (1.0x) NOT affected by gate', () => {
    expect(applyAttestationGate(1.0, false)).toBe(1.0)
    expect(applyAttestationGate(1.0, true)).toBe(1.0)
  })

  test('good evaluator WITHOUT attestation → capped at 1.0x', () => {
    expect(applyAttestationGate(1.3, false)).toBe(1.0)
    expect(applyAttestationGate(1.5, false)).toBe(1.0)
  })

  test('good evaluator WITH attestation → full weight preserved', () => {
    expect(applyAttestationGate(1.3, true)).toBe(1.3)
    expect(applyAttestationGate(1.5, true)).toBe(1.5)
  })

  test('edge: weight exactly 1.0 with no attestation → stays 1.0', () => {
    expect(applyAttestationGate(1.0, false)).toBe(1.0)
  })

  test('edge: weight 1.001 without attestation → capped to 1.0', () => {
    expect(applyAttestationGate(1.001, false)).toBe(1.0)
  })

  test('edge: worst evaluator (0.5x) always penalized regardless of attestation', () => {
    expect(applyAttestationGate(0.5, false)).toBe(0.5)
    expect(applyAttestationGate(0.5, true)).toBe(0.5)
  })

  // ─── Config ───────────────────────────────────────────────────────────────

  test('testnet config: min 1 attestation, any predicate, no recursive check', () => {
    const cfg = ATTESTATION_CONFIG_TESTNET
    expect(cfg.minAttestations).toBe(1)
    expect(cfg.acceptedPredicates).toEqual([])
    expect(cfg.requireAttestedAttestors).toBe(false)
  })

  test('mainnet config: min 3 attestations, specific predicates, recursive check', () => {
    const cfg = ATTESTATION_CONFIG_MAINNET
    expect(cfg.minAttestations).toBe(3)
    expect(cfg.acceptedPredicates).toContain('trust')
    expect(cfg.acceptedPredicates).toContain('endorses')
    expect(cfg.requireAttestedAttestors).toBe(true)
  })

  test('getAttestationConfig returns testnet config when CHAIN_ID is 13579', () => {
    const original = process.env.NEXT_PUBLIC_CHAIN_ID
    process.env.NEXT_PUBLIC_CHAIN_ID = '13579'
    const cfg = getAttestationConfig()
    expect(cfg.minAttestations).toBe(1)
    process.env.NEXT_PUBLIC_CHAIN_ID = original
  })

  test('getAttestationConfig returns mainnet config when CHAIN_ID is not 13579', () => {
    const original = process.env.NEXT_PUBLIC_CHAIN_ID
    process.env.NEXT_PUBLIC_CHAIN_ID = '1'
    const cfg = getAttestationConfig()
    expect(cfg.minAttestations).toBe(3)
    process.env.NEXT_PUBLIC_CHAIN_ID = original
  })

  test('getAttestationConfig FAILS SAFE to testnet config + warns when CHAIN_ID is unset', () => {
    const original = process.env.NEXT_PUBLIC_CHAIN_ID
    delete process.env.NEXT_PUBLIC_CHAIN_ID
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const cfg = getAttestationConfig()
    expect(cfg).toEqual(ATTESTATION_CONFIG_TESTNET)
    expect(warnSpy).toHaveBeenCalledOnce()
    expect(warnSpy.mock.calls[0][0]).toContain('NEXT_PUBLIC_CHAIN_ID not set')

    warnSpy.mockRestore()
    if (original === undefined) {
      delete process.env.NEXT_PUBLIC_CHAIN_ID
    } else {
      process.env.NEXT_PUBLIC_CHAIN_ID = original
    }
  })

  // ─── Gate semantics ───────────────────────────────────────────────────────

  test('gate only affects positive amplification — all sub-1.0 weights pass through', () => {
    const weights = [0.5, 0.6, 0.75, 0.9, 0.99]
    for (const w of weights) {
      expect(applyAttestationGate(w, false)).toBe(w)
      expect(applyAttestationGate(w, true)).toBe(w)
    }
  })

  test('gate is binary — with attestation, full weight; without, exactly 1.0', () => {
    const superWeight = 1.45
    expect(applyAttestationGate(superWeight, false)).toBe(1.0)   // capped, not partially reduced
    expect(applyAttestationGate(superWeight, true)).toBe(1.45)  // fully preserved
  })
})
