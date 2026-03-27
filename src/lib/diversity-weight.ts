/**
 * Diversity-Weighted Ratio — Whale Detection
 *
 * Reduces the influence of large individual stakers (whales) when computing
 * the support ratio used in hybridScore. A staker controlling > 50% of a side
 * is soft-capped to 0.5x weight; > 25% gets 0.75x; ≤ 25% gets 1.0x.
 *
 * This prevents a single wallet from fully dominating the trust signal.
 */

export interface StakerPosition {
  account_id: string
  shares: string // bigint as decimal string (wei)
}

/** Weight multiplier assigned to a staker based on their share of a side's total */
export function getDiversityWeight(stakerShares: bigint, totalShares: bigint): number {
  if (totalShares === 0n) return 1.0
  // Compute fraction as a float (0–1)
  const fraction = Number(stakerShares) / Number(totalShares)
  if (fraction > 0.5) return 0.5
  if (fraction > 0.25) return 0.75
  return 1.0
}

/**
 * Calculate support ratio with whale dampening.
 *
 * Instead of summing raw shares, each staker's contribution is weighted by
 * getDiversityWeight(). The final ratio is: weightedSupport / weightedTotal × 100.
 *
 * Falls back to 50 (neutral) when there is no stake on either side.
 *
 * Optional evaluatorWeights: Map<account_id, evaluatorWeight (0.5–1.5)>
 * When provided, each staker's effective stake is further multiplied by their
 * evaluator weight (track record accuracy). Default weight = 1.0 (neutral).
 * Backward compatible — omit evaluatorWeights to preserve original behavior.
 */
export function calculateDiversityWeightedRatio(
  supportPositions: StakerPosition[],
  opposePositions: StakerPosition[],
  evaluatorWeights?: Map<string, number>,
): number {
  const toWeighted = (positions: StakerPosition[]): number => {
    if (positions.length === 0) return 0
    const total = positions.reduce((acc, p) => {
      try { return acc + BigInt(p.shares || '0') } catch { return acc }
    }, 0n)
    if (total === 0n) return 0
    return positions.reduce((acc, p) => {
      try {
        const shares = BigInt(p.shares || '0')
        const diversityW = getDiversityWeight(shares, total)
        const evaluatorW = evaluatorWeights?.get(p.account_id.toLowerCase()) ?? 1.0
        return acc + Number(shares) * diversityW * evaluatorW
      } catch { return acc }
    }, 0)
  }

  const weightedSupport = toWeighted(supportPositions)
  const weightedOppose = toWeighted(opposePositions)
  const weightedTotal = weightedSupport + weightedOppose
  if (weightedTotal === 0) return 50
  return Math.round((weightedSupport / weightedTotal) * 100)
}

/** Diagnostic info for debugging / tooltip display */
export interface DiversityDiagnostic {
  supportStakers: number
  opposeStakers: number
  topSupportFraction: number   // 0–1, largest single staker on support side
  topOpposeFraction: number    // 0–1, largest single staker on oppose side
  whaleDetected: boolean       // true if any staker holds > 25% of their side
  weightedRatio: number
  rawRatio: number
}

export function getDiversityDiagnostic(
  supportPositions: StakerPosition[],
  opposePositions: StakerPosition[],
): DiversityDiagnostic {
  const topFraction = (positions: StakerPosition[]): number => {
    if (positions.length === 0) return 0
    const total = positions.reduce((acc, p) => {
      try { return acc + BigInt(p.shares || '0') } catch { return acc }
    }, 0n)
    if (total === 0n) return 0
    const max = positions.reduce((acc, p) => {
      try { const s = BigInt(p.shares || '0'); return s > acc ? s : acc } catch { return acc }
    }, 0n)
    return Number(max) / Number(total)
  }

  const rawTotal = (positions: StakerPosition[]): number =>
    positions.reduce((acc, p) => {
      try { return acc + Number(BigInt(p.shares || '0')) } catch { return acc }
    }, 0)

  const supTotal = rawTotal(supportPositions)
  const oppTotal = rawTotal(opposePositions)
  const grandTotal = supTotal + oppTotal
  const rawRatio = grandTotal > 0 ? Math.round((supTotal / grandTotal) * 100) : 50

  const tsf = topFraction(supportPositions)
  const tof = topFraction(opposePositions)

  return {
    supportStakers: supportPositions.length,
    opposeStakers: opposePositions.length,
    topSupportFraction: tsf,
    topOpposeFraction: tof,
    whaleDetected: tsf > 0.25 || tof > 0.25,
    weightedRatio: calculateDiversityWeightedRatio(supportPositions, opposePositions),
    rawRatio,
  }
}
