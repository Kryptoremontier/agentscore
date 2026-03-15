// src/lib/hybrid-trust.ts
// Hybrid Trust Score — main AGENTSCORE combining economic confidence + quality metrics

import type { TrustLevel } from '@/types/agent'

/**
 * Hybrid Trust Score — combines economic confidence (Trust Score)
 * with multi-dimensional quality (Composite Trust Score).
 *
 * Formula: 60% Trust Score + 40% Composite Score
 * Soft gate: if support ratio < 50%, score is scaled linearly 0→1
 * (smooth penalty vs hard cut — avoids cliff-edge at 30%)
 */
export function calculateHybridScore(
  trustScore: number,      // 0-100, from calculateTrustScore()
  compositeScore: number,  // 0-100, from calculateComposite()
  supportRatio: number     // 0-100, raw support vs oppose percentage
): number {
  const hybridRaw = trustScore * 0.6 + compositeScore * 0.4

  // Soft gate: low support ratio scales the entire score down smoothly
  if (supportRatio < 50) {
    const scaleFactor = supportRatio / 50  // 0.0 → 1.0 as ratio goes 0 → 50%
    return Math.round(hybridRaw * scaleFactor * 10) / 10
  }

  return Math.round(hybridRaw * 10) / 10
}

/**
 * Trust level for hybrid score.
 * Uses wider bands than raw Trust Score (90/70/50/30 → 80/60/40/20)
 * to account for Composite pulling scores toward center.
 */
export function getHybridLevel(score: number): TrustLevel {
  if (score >= 80) return 'excellent'
  if (score >= 60) return 'good'
  if (score >= 40) return 'moderate'
  if (score >= 20) return 'low'
  return 'critical'
}
