/**
 * Evaluator Score Engine
 *
 * Tracks staker accuracy across all their positions.
 * A staker who consistently backed agents that maintained trust
 * earns higher influence weight on future stakes.
 *
 * Formula:
 *   rawAccuracy    = goodPicks / totalPicks
 *   confidence     = 1 - e^(-totalPicks / 5)
 *   adjustedAccuracy = 0.5 + (rawAccuracy - 0.5) × confidence
 *   evaluatorWeight  = 0.5 + adjustedAccuracy
 *
 *   Range: 0.5x (bad evaluator) to 1.5x (excellent evaluator)
 *   New staker with no history: 1.0x (neutral)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EvaluatorProfile {
  address: string
  totalPositions: number       // eligible positions (excl. self-created)
  goodPicks: number            // correct evaluations
  rawAccuracy: number          // 0.0 — 1.0
  confidence: number           // 0.0 — 1.0 (more positions = higher)
  adjustedAccuracy: number     // anchored at 0.5
  evaluatorWeight: number      // 0.5x — 1.5x
  evaluatorTier: EvaluatorTier
  streakCount: number          // consecutive correct picks (most recent first)
  bestPick: string | null      // agent name with highest trust score
  worstPick: string | null     // agent name with lowest trust score
}

export type EvaluatorTier =
  | 'newcomer'    // < 3 positions
  | 'scout'       // 3+ positions, accuracy < 60%
  | 'analyst'     // 5+ positions, accuracy >= 60%
  | 'oracle'      // 10+ positions, accuracy >= 75%
  | 'sage'        // 20+ positions, accuracy >= 85%

export interface StakerPosition {
  agentAtomId: string
  agentName: string
  side: 'support' | 'oppose'
  currentTrustScore: number    // 0–100 support ratio of this agent
  isCreator: boolean           // exclude from track record if true
  stakedAt?: string            // ISO timestamp (optional, used for streak)
}

// ─── Core Calculation ─────────────────────────────────────────────────────────

/**
 * Calculate evaluator profile from staker's positions.
 *
 * "Good pick" definition:
 *   - Staked SUPPORT on agent with trust > 50% → correct
 *   - Staked OPPOSE on agent with trust < 50%  → correct
 *   - Everything else → incorrect
 *
 * Self-created agents are EXCLUDED from track record.
 */
export function calculateEvaluatorScore(
  address: string,
  positions: StakerPosition[],
): EvaluatorProfile {
  const validPositions = positions.filter(p => !p.isCreator)
  const total = validPositions.length

  if (total === 0) {
    return {
      address,
      totalPositions: 0,
      goodPicks: 0,
      rawAccuracy: 0.5,
      confidence: 0,
      adjustedAccuracy: 0.5,
      evaluatorWeight: 1.0,
      evaluatorTier: 'newcomer',
      streakCount: 0,
      bestPick: null,
      worstPick: null,
    }
  }

  const goodPicks = validPositions.filter(p => {
    if (p.side === 'support' && p.currentTrustScore > 50) return true
    if (p.side === 'oppose'  && p.currentTrustScore < 50) return true
    return false
  }).length

  const rawAccuracy = goodPicks / total

  // Confidence: τ=5 → at 5 positions 63%, at 10 positions 86%, at 20 positions 98%
  const confidence = 1 - Math.exp(-total / 5)

  // Pull toward neutral (0.5) when low confidence
  const adjustedAccuracy = 0.5 + (rawAccuracy - 0.5) * confidence

  // 0.5 (worst) → 1.5 (best)
  const evaluatorWeight = Math.round((0.5 + adjustedAccuracy) * 1000) / 1000

  // Streak: consecutive good picks from most recent (last in array = most recent)
  let streakCount = 0
  const reversed = [...validPositions].reverse()
  for (const p of reversed) {
    const isGood =
      (p.side === 'support' && p.currentTrustScore > 50) ||
      (p.side === 'oppose'  && p.currentTrustScore < 50)
    if (isGood) streakCount++
    else break
  }

  // Best & worst picks (support positions only — we know "correct" direction)
  const supportPositions = validPositions.filter(p => p.side === 'support')
  const bestPick = supportPositions.length > 0
    ? supportPositions.reduce((best, p) =>
        p.currentTrustScore > best.currentTrustScore ? p : best
      ).agentName
    : null
  const worstPick = supportPositions.length > 0
    ? supportPositions.reduce((worst, p) =>
        p.currentTrustScore < worst.currentTrustScore ? p : worst
      ).agentName
    : null

  return {
    address,
    totalPositions: total,
    goodPicks,
    rawAccuracy:       Math.round(rawAccuracy       * 1000) / 1000,
    confidence:        Math.round(confidence        * 1000) / 1000,
    adjustedAccuracy:  Math.round(adjustedAccuracy  * 1000) / 1000,
    evaluatorWeight,
    evaluatorTier: getEvaluatorTier(adjustedAccuracy, total),
    streakCount,
    bestPick,
    worstPick,
  }
}

function getEvaluatorTier(accuracy: number, total: number): EvaluatorTier {
  if (total < 3)                         return 'newcomer'
  if (total >= 20 && accuracy >= 0.85)   return 'sage'
  if (total >= 10 && accuracy >= 0.75)   return 'oracle'
  if (total >= 5  && accuracy >= 0.60)   return 'analyst'
  return 'scout'
}

// ─── Tier Display Config ──────────────────────────────────────────────────────

export const EVALUATOR_TIER_CONFIG: Record<EvaluatorTier, {
  label: string
  color: string
  bgColor: string
  icon: string
  description: string
}> = {
  newcomer: {
    label: 'Newcomer',
    color: 'text-white/40',
    bgColor: 'bg-white/5',
    icon: '🌱',
    description: 'Just getting started — build your track record',
  },
  scout: {
    label: 'Scout',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    icon: '🔍',
    description: 'Active evaluator — developing accuracy',
  },
  analyst: {
    label: 'Analyst',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    icon: '📊',
    description: 'Reliable evaluator — 60%+ accuracy',
  },
  oracle: {
    label: 'Oracle',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    icon: '🔮',
    description: 'Expert evaluator — 75%+ accuracy, 10+ evaluations',
  },
  sage: {
    label: 'Sage',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    icon: '🧙',
    description: 'Master evaluator — 85%+ accuracy, 20+ evaluations',
  },
}
