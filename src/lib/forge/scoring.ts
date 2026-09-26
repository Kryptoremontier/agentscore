/**
 * Forge scoring adapter — reuses the AgentScore scoring engine.
 * Does NOT modify scoring engine files — only imports and calls them.
 */

import { calculateTrustScoreFromStakes } from '@/lib/trust-score-engine'
import { calculateHybridScore } from '@/lib/hybrid-trust'
import { calculateCompositeTrust } from '@/lib/composite-trust'
import { calculateDiversityWeightedRatio } from '@/lib/diversity-weight'
import { computeScoreEnvelope } from '@/lib/scoring/engine'
import type { ForgeProject } from '@/lib/forge/types'

export interface ForgeTrustInput {
  supportStakeWei: bigint
  opposeStakeWei: bigint
  uniqueStakers: number
  stableDays?: number
  currentPrice?: number
  peakPrice?: number
  recentSells?: Array<{ shares: number; totalSupply: number; timestamp: string }>
  evaluatorWeights?: Map<string, number>
  supportPositions?: Array<{ account_id: string; shares: bigint }>
  opposePositions?: Array<{ account_id: string; shares: bigint }>
}

export interface ForgeTrustResult {
  trustScore: number
  compositeScore: number
  finalScore: number
  momentum: 'up' | 'down' | 'stable'
}

export function calculateForgeTrustScore(input: ForgeTrustInput): ForgeTrustResult {
  const {
    supportStakeWei,
    opposeStakeWei,
    uniqueStakers,
    stableDays = 0,
    currentPrice = 1,
    peakPrice = 1,
    recentSells = [],
    evaluatorWeights,
    supportPositions = [],
    opposePositions = [],
  } = input

  // 1. Raw trust score from stakes
  const trustResult = calculateTrustScoreFromStakes(supportStakeWei, opposeStakeWei)

  // 2. Diversity-weighted signal ratio (anti-whale layer)
  const weightedRatio = supportPositions.length > 0 || opposePositions.length > 0
    ? calculateDiversityWeightedRatio(
        supportPositions.map(p => ({ account_id: p.account_id, shares: p.shares.toString() })),
        opposePositions.map(p => ({ account_id: p.account_id, shares: p.shares.toString() })),
        evaluatorWeights,
      )
    : trustResult.baseScore

  // 3. Composite score (whale-exit + stability)
  const compositeResult = calculateCompositeTrust({
    weightedSignalRatio: weightedRatio,
    uniqueStakers,
    stableDays,
    currentPrice,
    peakPrice,
    recentSells,
  })

  // 4. Hybrid score (60% trust, 40% composite; no soft gate)
  const supportRatio = trustResult.baseScore
  const finalScore = calculateHybridScore(trustResult.score, compositeResult.score, supportRatio)

  // 5. Momentum from raw trust momentum field
  const m = trustResult.momentum
  const momentum: 'up' | 'down' | 'stable' = m > 1 ? 'up' : m < -1 ? 'down' : 'stable'

  return {
    trustScore: Math.round(trustResult.score),
    compositeScore: Math.round(compositeResult.score),
    finalScore: Math.round(finalScore),
    momentum,
  }
}

/** The project's score envelope, or null when its scores are unknown (oppose read failed). */
export function getForgeProjectScore(project: Pick<ForgeProject, 'trustScore' | 'compositeScore'>) {
  if (project.trustScore == null) return null
  return computeScoreEnvelope({
    objectType: 'project',
    trustScore: project.trustScore,
    qualityScore: project.compositeScore,
    softGateActive: false,
  })
}

/** Sort by finalScore, highest first; a project whose score is unknown (null) ranks last. */
export function compareForgeScoreDesc(a: Pick<ForgeProject, 'finalScore'>, b: Pick<ForgeProject, 'finalScore'>): number {
  if (a.finalScore == null || b.finalScore == null) return (a.finalScore == null ? 1 : 0) - (b.finalScore == null ? 1 : 0)
  return b.finalScore - a.finalScore
}

/** Mean finalScore over projects whose score is known; null when none is. */
export function meanKnownForgeScore(projects: ReadonlyArray<Pick<ForgeProject, 'finalScore'>>): number | null {
  const known = projects.map(p => p.finalScore).filter((s): s is number => s != null)
  return known.length ? known.reduce((a, b) => a + b, 0) / known.length : null
}

/**
 * Calculate sparkline from score history snapshots (7 points, newest last).
 */
export function buildSparkline(scores: number[]): number[] {
  if (scores.length === 0) return [50]
  if (scores.length >= 7) return scores.slice(-7)
  // Pad left with first value
  const pad = Array(7 - scores.length).fill(scores[0])
  return [...pad, ...scores]
}
