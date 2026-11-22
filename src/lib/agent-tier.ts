/**
 * Agent tier — derived ONLY from attestations (thesis §6 "Agent tiers").
 *
 * An agent's tier is derived only from attestations: distinct live attesters
 * (wallets with shares > 0 on attestation triples) and tTRUST attested on those
 * triples. Backing on the agent's atom vault never changes its tier.
 *   Verified: ≥ 3 attesters and ≥ 0.1 tTRUST.
 *   Trusted:  ≥ 2 attesters and ≥ 0.05 tTRUST.
 *   Otherwise Unverified. A single wallet can never lift an agent above Unverified.
 *
 * Every agent surface (list card, modal, /agents/[id], REST, MCP) calls
 * calculateAgentTier and nothing else. `calculateTier` (trust-tiers.ts) stays
 * for skills, claims, IntuForge projects and My Agents — it is not an agent tier.
 * No age, no support ratio, no vault stakers: none of those is an attestation.
 */

import { isLivePosition } from './live-position'
import type { AttesterSummary } from './agent-profile'
import { TIER_LABEL, TIER_RULE } from './people-copy'

export type AgentTier = 'unverified' | 'trusted' | 'verified'

/** Where the tier comes from — carried next to it on machine-read surfaces (REST `tierBasis`). */
export const AGENT_TIER_BASIS = 'attestations' as const
export type AgentTierBasis = typeof AGENT_TIER_BASIS

const WEI = 1_000_000_000_000_000_000n

/** The ladder (thesis §6). Stake thresholds in wei of tTRUST attested — the same unit the modal prints. */
export const AGENT_TIER_LADDER = {
  verified: { minAttesters: 3, minAttestedWei: WEI / 10n },  // 0.1 tTRUST
  trusted: { minAttesters: 2, minAttestedWei: WEI / 20n },   // 0.05 tTRUST
} as const

// ─── The default trust (Etap 9b) ──────────────────────────────────────────────

/**
 * What the vault keeps as shares of a deposit. The tier counts shares, and the MultiVault takes an
 * entry fee on the way in: measured on testnet, a 0.01 tTRUST trust became 0.0099 in shares (1%).
 */
export const VAULT_ENTRY_FEE_BPS = 100n
/** The default trust is a round number of tTRUST: a multiple of 0.01. */
const TRUST_STEP_WEI = WEI / 100n

const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b
/** What each of a rung's minimum people must deposit so their shares, together, reach its minimum stake. */
const perPersonDeposit = (rung: { minAttesters: number; minAttestedWei: bigint }) =>
  ceilDiv(ceilDiv(rung.minAttestedWei, BigInt(rung.minAttesters)) * 10_000n, 10_000n - VAULT_ENTRY_FEE_BPS)

/**
 * The trust dialog's default amount, derived from the ladder above (never a second number): the
 * smallest round amount with which the minimum number of people reach each rung — 2 default trusts
 * are Established, 3 are Verified — after the vault's entry fee. Today: 0.04 tTRUST.
 */
export const DEFAULT_TRUST_WEI = ((): bigint => {
  const need = [AGENT_TIER_LADDER.trusted, AGENT_TIER_LADDER.verified].map(perPersonDeposit).reduce((a, b) => (a > b ? a : b))
  return ceilDiv(need, TRUST_STEP_WEI) * TRUST_STEP_WEI
})()

/** The same amount as the dialog's input shows it ("0.04"). */
export const DEFAULT_TRUST_AMOUNT = (() => {
  const whole = DEFAULT_TRUST_WEI / WEI
  const frac = (DEFAULT_TRUST_WEI % WEI).toString().padStart(18, '0').replace(/0+$/, '')
  return frac ? `${whole}.${frac}` : `${whole}`
})()

/** Badge visuals — same palette as the other tier chips (trust-tiers.ts); label and rule text from people-copy (Etap 8a: `trusted` reads "Established"). */
export interface AgentTierDisplay {
  tier: AgentTier
  label: string
  color: string
  bgColor: string
  borderColor: string
  icon: string
  description: string
}

export const AGENT_TIER_DISPLAY: Record<AgentTier, AgentTierDisplay> = {
  verified: {
    tier: 'verified', label: TIER_LABEL.verified, color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.3)', icon: '⭐',
    description: TIER_RULE.verified,
  },
  trusted: {
    tier: 'trusted', label: TIER_LABEL.trusted, color: '#22c55e',
    bgColor: 'rgba(34, 197, 94, 0.15)', borderColor: 'rgba(34, 197, 94, 0.3)', icon: '✓',
    description: TIER_RULE.trusted,
  },
  unverified: {
    tier: 'unverified', label: TIER_LABEL.unverified, color: '#6b7280',
    bgColor: 'rgba(107, 114, 128, 0.15)', borderColor: 'rgba(107, 114, 128, 0.3)', icon: '○',
    description: TIER_RULE.unverified,
  },
}

export interface AgentTierResult {
  tier: AgentTier
  display: AgentTierDisplay
  basis: AgentTierBasis
  /** Distinct live attesters (the input's length, 0-share wallets excluded). */
  attesters: number
  /** tTRUST attested by those attesters, wei. */
  attestedWei: bigint
  /** The next rung and its thresholds; null at Verified. */
  next: { tier: Exclude<AgentTier, 'unverified'>; minAttesters: number; minAttestedWei: bigint } | null
}

/**
 * The agent tier. Input = `summarizeAttesters(entries)` — the one distinct-attester
 * derivation (agent-profile.ts) — and nothing else.
 */
export function calculateAgentTier(attesters: readonly AttesterSummary[]): AgentTierResult {
  // summarizeAttesters already drops sold-out wallets; the same rule again so a hand-built
  // summary can't lift an agent (a 0-share wallet is not an attester — commit be09ad3).
  const live = (attesters ?? []).filter((a) => !!a?.wallet && isLivePosition({ shares: a.totalStake }))
  const count = live.length
  const attestedWei = live.reduce((sum, a) => sum + a.totalStake, 0n)
  const meets = (rung: { minAttesters: number; minAttestedWei: bigint }) =>
    count >= rung.minAttesters && attestedWei >= rung.minAttestedWei
  const tier: AgentTier = meets(AGENT_TIER_LADDER.verified) ? 'verified'
    : meets(AGENT_TIER_LADDER.trusted) ? 'trusted'
    : 'unverified'
  const next = tier === 'verified' ? null
    : tier === 'trusted' ? { tier: 'verified' as const, ...AGENT_TIER_LADDER.verified }
    : { tier: 'trusted' as const, ...AGENT_TIER_LADDER.trusted }
  return { tier, display: AGENT_TIER_DISPLAY[tier], basis: AGENT_TIER_BASIS, attesters: count, attestedWei, next }
}
