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
 *
 * Good pick definition (PNL-based when available, trust-score fallback):
 *   PNL mode:   support position with profit → correct
 *               oppose position with loss    → correct
 *   Trust mode: support with trustScore > 50 → correct
 *               oppose with trustScore < 50  → correct
 */

import { calculateWalletPNL, type PositionPNL, type WalletPNL } from './pnl-engine'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EvaluatorProfile {
  address: string
  totalPositions: number       // eligible positions (excl. self-created)
  goodPicks: number            // correct evaluations
  rawAccuracy: number          // 0.0 — 1.0
  confidence: number           // 0.0 — 1.0 (more positions = higher)
  adjustedAccuracy: number     // anchored at 0.5
  evaluatorWeight: number      // 0.5x — 1.5x (gated: may be capped at 1.0)
  rawEvaluatorWeight: number   // pre-gate weight (before attestation cap)
  evaluatorTier: EvaluatorTier
  streakCount: number          // consecutive correct picks (most recent first)
  bestPick: string | null      // agent name with highest trust score
  worstPick: string | null     // agent name with lowest trust score
  // Attestation Gate (Layer 7)
  meetsAttestationThreshold: boolean | null  // null = not yet checked
  attestationCount: number                   // distinct wallets that attested
  // PNL Engine
  walletPNL?: WalletPNL                      // aggregate PNL across evaluator positions
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
  pnl?: PositionPNL            // on-chain P&L data (optional — scoring falls back if absent)
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
 *
 * options.meetsAttestationThreshold — if provided, applies Layer 7 attestation gate:
 *   evaluatorWeight > 1.0 is capped at 1.0 when attestation threshold is not met.
 *   null/undefined = gate not applied (backward-compatible).
 */
export function calculateEvaluatorScore(
  address: string,
  positions: StakerPosition[],
  options?: {
    meetsAttestationThreshold?: boolean
    attestationCount?: number
    walletPNL?: WalletPNL
  },
): EvaluatorProfile {
  const validPositions = positions.filter(p => !p.isCreator)
  const total = validPositions.length

  // Compute walletPNL from positions.pnl[] when available, fall back to options
  const pnlItems = validPositions
    .map(p => p.pnl)
    .filter((p): p is PositionPNL => p !== undefined)
  const walletPNL: WalletPNL | undefined = pnlItems.length > 0
    ? calculateWalletPNL(pnlItems)
    : options?.walletPNL

  if (total === 0) {
    return {
      address,
      totalPositions: 0,
      goodPicks: 0,
      rawAccuracy: 0.5,
      confidence: 0,
      adjustedAccuracy: 0.5,
      evaluatorWeight: 1.0,
      rawEvaluatorWeight: 1.0,
      evaluatorTier: 'newcomer',
      streakCount: 0,
      bestPick: null,
      worstPick: null,
      meetsAttestationThreshold: options?.meetsAttestationThreshold ?? null,
      attestationCount: options?.attestationCount ?? 0,
      walletPNL,
    }
  }

  // Good pick: PNL-based when data available, trust-score fallback otherwise
  function isGoodPick(p: StakerPosition): boolean {
    if (p.pnl !== undefined) {
      if (p.pnl.isProfit && p.side === 'support') return true
      if (!p.pnl.isProfit && p.side === 'oppose') return true
      return false
    }
    if (p.side === 'support' && p.currentTrustScore > 50) return true
    if (p.side === 'oppose'  && p.currentTrustScore < 50) return true
    return false
  }

  const goodPicks = validPositions.filter(isGoodPick).length

  const rawAccuracy = goodPicks / total

  // Confidence: τ=5 → at 5 positions 63%, at 10 positions 86%, at 20 positions 98%
  const confidence = 1 - Math.exp(-total / 5)

  // Pull toward neutral (0.5) when low confidence
  const adjustedAccuracy = 0.5 + (rawAccuracy - 0.5) * confidence

  // 0.5 (worst) → 1.5 (best)
  const rawEvaluatorWeight = Math.round((0.5 + adjustedAccuracy) * 1000) / 1000

  // Apply attestation gate (Layer 7): cap weight at 1.0 if threshold not met
  const meetsThreshold = options?.meetsAttestationThreshold
  const evaluatorWeight = meetsThreshold !== undefined
    ? (rawEvaluatorWeight > 1.0 && !meetsThreshold ? 1.0 : rawEvaluatorWeight)
    : rawEvaluatorWeight

  // Streak: consecutive good picks from most recent (last in array = most recent)
  let streakCount = 0
  const reversed = [...validPositions].reverse()
  for (const p of reversed) {
    if (isGoodPick(p)) streakCount++
    else break
  }

  // Best & worst picks (support positions only)
  // When PNL data available: rank by pnlPercent; otherwise by trust score
  const supportPositions = validPositions.filter(p => p.side === 'support')
  const hasPNL = supportPositions.some(p => p.pnl !== undefined)

  const bestPick = supportPositions.length > 0
    ? (hasPNL
        ? supportPositions
            .filter(p => p.pnl !== undefined)
            .reduce((best, p) => p.pnl!.pnlPercent > best.pnl!.pnlPercent ? p : best)
            .agentName
        : supportPositions.reduce((best, p) =>
            p.currentTrustScore > best.currentTrustScore ? p : best
          ).agentName)
    : null

  const worstPick = supportPositions.length > 0
    ? (hasPNL
        ? supportPositions
            .filter(p => p.pnl !== undefined)
            .reduce((worst, p) => p.pnl!.pnlPercent < worst.pnl!.pnlPercent ? p : worst)
            .agentName
        : supportPositions.reduce((worst, p) =>
            p.currentTrustScore < worst.currentTrustScore ? p : worst
          ).agentName)
    : null

  return {
    address,
    totalPositions: total,
    goodPicks,
    rawAccuracy:       Math.round(rawAccuracy       * 1000) / 1000,
    confidence:        Math.round(confidence        * 1000) / 1000,
    adjustedAccuracy:  Math.round(adjustedAccuracy  * 1000) / 1000,
    evaluatorWeight,
    rawEvaluatorWeight,
    evaluatorTier: getEvaluatorTier(adjustedAccuracy, total),
    streakCount,
    bestPick,
    worstPick,
    meetsAttestationThreshold: options?.meetsAttestationThreshold ?? null,
    attestationCount: options?.attestationCount ?? 0,
    walletPNL,
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
    color: 'text-[#7A838D]',
    bgColor: 'bg-white/5',
    icon: 'shield',
    description: 'Just getting started — build your track record',
  },
  scout: {
    label: 'Scout',
    color: 'text-[#38B6FF]',
    bgColor: 'bg-[#38B6FF]/10',
    icon: 'eye',
    description: 'Active evaluator — developing accuracy',
  },
  analyst: {
    label: 'Analyst',
    color: 'text-[#A78BFA]',
    bgColor: 'bg-[#A78BFA]/10',
    icon: 'book-open',
    description: 'Reliable evaluator — 60%+ accuracy',
  },
  oracle: {
    label: 'Oracle',
    color: 'text-[#C8963C]',
    bgColor: 'bg-[#C8963C]/10',
    icon: 'sparkles',
    description: 'Expert evaluator — 75%+ accuracy, 10+ evaluations',
  },
  sage: {
    label: 'Sage',
    color: 'text-[#2ECC71]',
    bgColor: 'bg-[#2ECC71]/10',
    icon: 'crown',
    description: 'Master evaluator — 85%+ accuracy, 20+ evaluations',
  },
}
