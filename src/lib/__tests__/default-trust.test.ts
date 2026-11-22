/**
 * Etap 9b — what the page promises is what a default trust delivers.
 *
 * The page says "Two people make it Established. Three make it Verified." That is true only if 2
 * and 3 trusts of the dialog's default amount reach the rule's stake minimums — counted as the tier
 * counts them, in vault shares, after the vault's entry fee. The default is derived from the rule
 * (lib/agent-tier.ts DEFAULT_TRUST_WEI); these tests fail if the promise and the rule ever drift.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { parseEther } from 'viem'
import {
  AGENT_TIER_LADDER, DEFAULT_TRUST_WEI, DEFAULT_TRUST_AMOUNT, VAULT_ENTRY_FEE_BPS, calculateAgentTier,
} from '../agent-tier'
import { TIER_PROMISE, BUILDER_SEND, STORY_STEPS, trustBelowDefault } from '../people-copy'
import type { AttesterSummary } from '../agent-profile'

const SRC = path.join(__dirname, '..', '..')
const code = (f: string) => readFileSync(path.join(SRC, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
/** What a deposit becomes in the vault (the tier counts shares). */
const asShares = (wei: bigint) => (wei * (10_000n - VAULT_ENTRY_FEE_BPS)) / 10_000n
const people = (n: number, depositWei: bigint): AttesterSummary[] =>
  Array.from({ length: n }, (_, i) => ({ wallet: `0x${String(i + 1).padStart(40, '0')}`, domains: ['Social'], totalStake: asShares(depositWei) }))

describe('the default trust', () => {
  it('is 0.04 tTRUST, and the input shows it as "0.04"', () => {
    expect(DEFAULT_TRUST_WEI).toBe(parseEther('0.04'))
    expect(DEFAULT_TRUST_AMOUNT).toBe('0.04')
  })

  it('2 default trusts reach Established and 3 reach Verified — in deposits and in vault shares', () => {
    const { trusted, verified } = AGENT_TIER_LADDER
    expect(2n * DEFAULT_TRUST_WEI >= trusted.minAttestedWei).toBe(true)
    expect(3n * DEFAULT_TRUST_WEI >= verified.minAttestedWei).toBe(true)
    // What the tier actually counts: shares, after the vault's 1% entry fee (0.01 → 0.0099 on testnet).
    expect(2n * asShares(DEFAULT_TRUST_WEI) >= trusted.minAttestedWei).toBe(true)
    expect(3n * asShares(DEFAULT_TRUST_WEI) >= verified.minAttestedWei).toBe(true)
  })

  it('the tier rule itself says so: 2 people → Established, 3 → Verified, 1 → Unverified', () => {
    expect(calculateAgentTier(people(1, DEFAULT_TRUST_WEI)).tier).toBe('unverified')
    expect(calculateAgentTier(people(2, DEFAULT_TRUST_WEI)).tier).toBe('trusted')
    expect(calculateAgentTier(people(3, DEFAULT_TRUST_WEI)).tier).toBe('verified')
    // The old default (0.01) reached neither: the promise was false.
    expect(calculateAgentTier(people(3, parseEther('0.01'))).tier).toBe('unverified')
  })

  it('it is the smallest round amount that keeps the promise (0.03 would not)', () => {
    expect(calculateAgentTier(people(3, DEFAULT_TRUST_WEI - parseEther('0.01'))).tier).not.toBe('verified')
  })

  it('one source: derived from the ladder in agent-tier.ts, never a second number', () => {
    const tier = code('lib/agent-tier.ts')
    expect(tier).toMatch(/export const DEFAULT_TRUST_WEI = \(\(\): bigint => \{\s*const need = \[AGENT_TIER_LADDER\.trusted, AGENT_TIER_LADDER\.verified\]\.map\(perPersonDeposit\)/)
    const dialog = code('components/attest/AttestButton.tsx')
    expect(dialog).toMatch(/useState\(DEFAULT_TRUST_AMOUNT\)/)
    expect(dialog).not.toMatch(/useState\('0\.0\d'\)/)
  })
})

describe('the promise, and below the default', () => {
  it('the line, on the landing (How it works, 02) and on /check (the builder block)', () => {
    expect(TIER_PROMISE).toBe('Two people make it Established. Three make it Verified.')
    expect(STORY_STEPS[1].line).toContain(TIER_PROMISE)
    expect(BUILDER_SEND).toContain(TIER_PROMISE)
  })
  it('the person can still change the amount; below the default the dialog says what that costs', () => {
    expect(trustBelowDefault(DEFAULT_TRUST_AMOUNT)).toBe('Below 0.04, three people may not reach Verified.')
    const dialog = code('components/attest/AttestButton.tsx')
    expect(dialog).toMatch(/onChange=\{e => setAmount\(e\.target\.value\)\}/)
    expect(dialog).toMatch(/\{stakeWei !== null && stakeWei < DEFAULT_TRUST_WEI && \(\s*<p[^>]*data-testid="trust-below-default">\s*\{trustBelowDefault\(DEFAULT_TRUST_AMOUNT\)\}/)
  })
})
