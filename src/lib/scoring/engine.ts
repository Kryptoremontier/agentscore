/**
 * Score envelope computation — thin orchestration layer.
 *
 * Does NOT reimplement scoring math; delegates to the existing primitives:
 *   calculateHybridScore()  — combines trustScore + qualityScore
 *   getHybridLevel()        — derives TrustLevel from objectScore
 *
 * Callers supply pre-computed trustScore and (optionally) qualityScore.
 * When qualityScore is null the envelope marks objectScore null too, signalling
 * that consumers should fall back to trustScore for display.
 */

import { calculateHybridScore, getHybridLevel } from '@/lib/hybrid-trust'
import type { ScoreEnvelope, ScorableObjectType } from './types'

export interface ComputeScoreInput {
  objectType: ScorableObjectType
  /** Economic stake-ratio score (0–100). Required. */
  trustScore: number
  /**
   * Multi-pillar quality score (0–100).
   * Pass null when not enough data (< 3 stakers) or computation was skipped.
   */
  qualityScore: number | null
  /**
   * Support stake ratio (0–1). Passed through to calculateHybridScore but
   * currently unused there (soft gate removed Apr 2026). Keep for forward compat.
   */
  supportRatio?: number
  /** Legacy flag; keep false because the separate soft gate was removed. */
  softGateActive?: boolean
}

export function computeScoreEnvelope(input: ComputeScoreInput): ScoreEnvelope {
  const { objectType, trustScore, qualityScore, supportRatio = 0.5, softGateActive = false } = input

  const objectScore = qualityScore !== null
    ? calculateHybridScore(trustScore, qualityScore, supportRatio)
    : null

  const displayScore = objectScore ?? trustScore
  const tier = getHybridLevel(displayScore)

  return {
    objectType,
    trustScore,
    qualityScore,
    objectScore,
    tier,
    softGateActive,
    computedAt: new Date().toISOString(),
  }
}
