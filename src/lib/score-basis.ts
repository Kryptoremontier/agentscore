/**
 * Score basis — the one rule for "is this trust score a measurement?"
 *
 * `calculateTrustScoreFromStakes` shrinks toward a neutral anchor of 50: at
 * zero total stake its confidence is 0 and it returns exactly 50 with no data
 * in it. That is correct math for a prior (thesis §6 asks for shrinkage), but
 * printing it is printing a number nobody measured. The formula itself is
 * untouched; every surface that DISPLAYS a score asks this module first.
 *
 * Measured = total stake on the atom (support + oppose shares) > 0, where the
 * support side was actually read. Gate on stake, never on staker count: a
 * fully-redeemed or zero-share position still counts in positions_aggregate
 * (thesis §8 mine 6 — not an attestation, and not a measurement either).
 *
 * Pure, no I/O, no React — shared by /agents, the landing page, and the API.
 */

import type { TrustLevel } from '@/types/agent'
import { calculateTier, type TierConfig } from './trust-tiers'

export type ScoreBasis = 'measured' | 'prior'

/** Quality filter buckets on /agents: the five score levels, plus rows with no measured score. */
export type QualityBucket = TrustLevel | 'unrated'

export const NO_STAKE_TOOLTIP = 'No stake yet — nothing to measure.'

/** Raw stake read for one atom. `supportWei: null` = never fetched (or unparseable), not zero. */
export interface StakeReading {
  supportWei: bigint | null | undefined
  /** Oppose (counter-vault) shares. Absent = no counter vault / no oppose positions. */
  opposeWei?: bigint | null
}

/**
 * Parse an indexer `positions_aggregate` block into wei.
 * null  → the aggregate was never fetched (e.g. ERC-8004 cohort rows) or is unparseable.
 * 0n    → fetched, and the atom holds no shares.
 */
export function readSharesWei(
  agg: { aggregate?: { count?: number; sum?: { shares?: string | number | null } | null } | null } | null | undefined,
): bigint | null {
  if (!agg || !agg.aggregate) return null
  const raw = agg.aggregate.sum?.shares
  if (raw == null || raw === '') return 0n
  try {
    return BigInt(String(raw))
  } catch {
    return null
  }
}

/** Total stake on the atom (support + oppose shares) > 0, with support actually read. */
export function hasMeasuredScore(reading: StakeReading | null | undefined): boolean {
  if (!reading || reading.supportWei == null) return false
  return reading.supportWei + (reading.opposeWei ?? 0n) > 0n
}

export function scoreBasisOf(reading: StakeReading | null | undefined): ScoreBasis {
  return hasMeasuredScore(reading) ? 'measured' : 'prior'
}

/** The score to print, or null ("—") when it would only be the prior — or is still loading. */
export function measuredScore(
  trust: { score: number } | null | undefined,
  measured: boolean,
): number | null {
  return trust && measured ? trust.score : null
}

/** Which /agents quality bucket a row belongs to. Unmeasured rows are 'unrated', never 'moderate'. */
export function qualityBucket(trust: { level: TrustLevel }, measured: boolean): QualityBucket {
  return measured ? trust.level : 'unrated'
}

/**
 * Support share of the measured stake, 0-100 (integer floor), or null when
 * there is no stake to take a share of. Same arithmetic as the API's
 * supportRatio, minus its `: 50` fallback.
 */
export function supportPercent(reading: StakeReading | null | undefined): number | null {
  if (!hasMeasuredScore(reading)) return null
  const support = reading!.supportWei!
  const total = support + (reading!.opposeWei ?? 0n)
  return Number((support * 100n) / total)
}

/**
 * Vault tier from MEASURED inputs only — the list card's chip. Same inputs as
 * the API's trustTier (rowToAgentItem): staker count, support + oppose stake,
 * and the real support ratio; never a literal ratio.
 *
 * calculateTier has no "unmeasured ratio" input and is not changed here. A
 * ratio exists only when there is stake to take a share of, so an unmeasured
 * row gets null — no chip — instead of an invented ratio. (No information is
 * lost: at zero stake calculateTier returns Unverified for ANY ratio, because
 * every higher tier requires minTotalStake > 0 — pinned by tests.)
 */
export function measuredTier(input: {
  stakers: number
  supportWei: bigint | null | undefined
  opposeWei?: bigint | null
  ageDays: number
}): TierConfig | null {
  const reading = { supportWei: input.supportWei, opposeWei: input.opposeWei }
  const ratio = supportPercent(reading)
  if (ratio == null) return null
  const totalWei = input.supportWei! + (input.opposeWei ?? 0n)
  return calculateTier(input.stakers, Number(totalWei) / 1e18, ratio, input.ageDays)
}
