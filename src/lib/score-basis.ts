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

export type ScoreBasis = 'measured' | 'prior'

/** Quality filter buckets on /agents: the five score levels, plus rows with no measured score. */
export type QualityBucket = TrustLevel | 'unrated'

export const NO_STAKE_TOOLTIP = 'No stake yet — nothing to measure.'
/** The oppose side couldn't be read: no score is printed rather than one computed from a 0. */
export const OPPOSE_UNREAD_TOOLTIP = 'Couldn’t read the oppose stake — no score until it can be read.'
/** The stake was never read on this surface (ERC-8004 cohort rows on /agents): no claim about it. */
export const STAKE_UNREAD_TOOLTIP = 'Stake isn’t read on this list — no score shown here.'

/** Raw stake read for one atom. `supportWei: null` = never fetched (or unparseable), not zero. */
export interface StakeReading {
  supportWei: bigint | null | undefined
  /**
   * Oppose (counter-vault) shares. undefined = no counter vault (nothing to oppose, 0).
   * null = the oppose read FAILED: unknown — the score is not a measurement then (a
   * failed read is never taken as 0 oppose, which would inflate the score).
   */
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

/**
 * The stake reading of one list row, as /agents and the landing Featured cards hold it:
 * support from the row's `positions_aggregate` (null = never read), oppose from the
 * `__opposeWei` annotation (lib/agent-list.ts annotateVaultReads): undefined = no counter
 * vault / no oppose position (0n), null = the positions read failed (unknown — stays null).
 */
export function stakeReadingOf(row: {
  positions_aggregate?: Parameters<typeof readSharesWei>[0]
  __opposeWei?: bigint | null
}): { supportWei: bigint | null; opposeWei: bigint | null } {
  return {
    supportWei: readSharesWei(row.positions_aggregate),
    opposeWei: row.__opposeWei === null ? null : (row.__opposeWei ?? 0n),
  }
}

/**
 * For lists that print the stake-formula score at any stake (/skills, /claims): the score,
 * or null when the row's oppose side couldn't be read — a score computed on 0 oppose would
 * pass a failed read off as a measurement (inflated). Print "—" + OPPOSE_UNREAD_TOOLTIP.
 */
export function scoreUnlessOpposeUnread(trust: { score: number }, reading: StakeReading): number | null {
  return reading.opposeWei === null ? null : trust.score
}

/** Total stake on the atom (support + oppose shares) > 0, with both sides actually read. */
export function hasMeasuredScore(reading: StakeReading | null | undefined): boolean {
  if (!reading || reading.supportWei == null || reading.opposeWei === null) return false
  return reading.supportWei + (reading.opposeWei ?? 0n) > 0n
}

export function scoreBasisOf(reading: StakeReading | null | undefined): ScoreBasis {
  return hasMeasuredScore(reading) ? 'measured' : 'prior'
}

/**
 * Why a row prints "—": its stake was never read here (never fetched ≠ 0, REPO_MAP §7 rule 5),
 * its oppose side couldn't be read, or there is no stake to measure.
 */
export function noScoreTooltip(reading: StakeReading | null | undefined): string {
  if (!reading || reading.supportWei == null) return STAKE_UNREAD_TOOLTIP
  return reading.opposeWei === null ? OPPOSE_UNREAD_TOOLTIP : NO_STAKE_TOOLTIP
}

/**
 * The score a machine-read surface (REST, MCP) publishes for one agent: the
 * measured AGENTSCORE (`agentScore` = objectScore ?? trustScore), else null —
 * never the 50 prior, never a fallback constant. `scoreBasis` goes next to it:
 * 'measured' | 'prior', or null when the atom is not a scored AgentScore agent
 * (no detail: an ERC-8004 cohort agent, a skill, any other atom).
 */
export function publishedAgentScore(
  detail: { agentScore: number; scoreBasis: ScoreBasis } | null | undefined,
): { score: number | null; scoreBasis: ScoreBasis | null } {
  if (!detail) return { score: null, scoreBasis: null }
  return { score: detail.scoreBasis === 'measured' ? detail.agentScore : null, scoreBasis: detail.scoreBasis }
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
