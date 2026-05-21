/**
 * Canonical scoring vocabulary for AgentScore.
 *
 * Three orthogonal dimensions → one envelope:
 *   trustScore   — economic confidence (bonding-curve stake ratio)
 *   qualityScore — multi-pillar quality (signal ratio, diversity, stability, price retention)
 *   objectScore  — final AGENTSCORE = trustScore × 0.60 + qualityScore × 0.40
 */

import type { TrustLevel } from '@/types/agent'

// ─── Scalars ─────────────────────────────────────────────────────────────────

/** Economic confidence derived from on-chain support/oppose stake (0–100). */
export type TrustScore = number

/** Multi-pillar quality metric: signal ratio, staker diversity, stability, price retention (0–100). */
export type QualityScore = number

/** Final published score: trustScore × 0.60 + qualityScore × 0.40 (0–100). */
export type ObjectScore = number

// ─── Object types ─────────────────────────────────────────────────────────────

export type ScorableObjectType =
  | 'agent'      // AI agent registered in AgentScore
  | 'claim'      // Generic Intuition triple / claim
  | 'evaluator'  // Staker with accuracy-weighted score (0.5x–1.5x weight)
  | 'project'    // IntuForge project
  | 'skill'      // Skill atom

// ─── Envelope ────────────────────────────────────────────────────────────────

/**
 * Standard score payload returned by all AgentScore API endpoints.
 *
 * Consumers SHOULD use `objectScore` for ranking/display.
 * `qualityScore` may be null for objects that haven't accumulated enough
 * signal data (< 3 stakers) — in that case `objectScore` falls back to `trustScore`.
 */
export interface ScoreEnvelope {
  objectType: ScorableObjectType
  trustScore: TrustScore
  qualityScore: QualityScore | null
  objectScore: ObjectScore | null
  /** Human-readable tier derived from objectScore (or trustScore when objectScore is null). */
  tier: TrustLevel
  /** Legacy field; always false because the separate soft gate was removed. */
  softGateActive: boolean
  /** ISO-8601 timestamp when this envelope was computed. */
  computedAt: string
}
