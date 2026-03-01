// src/lib/composite-trust.ts
// Composite Trust Score — whale-exit protection layer

// ─── Types ───

export type SellReason =
  | 'liquidity'    // Need cash urgently
  | 'rebalance'    // Portfolio rebalancing
  | 'profit'       // Taking profits
  | 'distrust'     // Lost trust in agent

export interface SellReasonConfig {
  id: SellReason
  label: string
  icon: string
  trustImpact: number    // 0.0 (no impact) to 1.0 (max negative impact)
  description: string
}

export const SELL_REASONS: SellReasonConfig[] = [
  {
    id: 'liquidity',
    label: 'Need Liquidity',
    icon: '💧',
    trustImpact: 0.1,
    description: 'Emergency cash need — minimal trust signal',
  },
  {
    id: 'rebalance',
    label: 'Rebalancing',
    icon: '⚖️',
    trustImpact: 0.25,
    description: 'Portfolio optimization — low trust signal',
  },
  {
    id: 'profit',
    label: 'Taking Profits',
    icon: '📈',
    trustImpact: 0.5,
    description: 'Locking in gains — moderate trust signal',
  },
  {
    id: 'distrust',
    label: 'Lost Trust',
    icon: '⚠️',
    trustImpact: 0.9,
    description: 'Genuine distrust — high negative signal',
  },
]

export interface CompositeResult {
  score: number              // 0-100, composite trust score
  breakdown: {
    signalScore: number      // weighted signal ratio contribution
    stakerScore: number      // unique stakers contribution
    stabilityScore: number   // sustained-stability contribution
    priceScore: number       // price retention contribution
  }
  isStable: boolean          // true if score has been stable for ≥7 days
  priceRetentionRatio: number // currentPrice / peakPrice (0–1)
}

export const COMPOSITE_WEIGHTS = {
  SIGNAL_RATIO: 0.40,    // 40% — weighted signal ratio (time-decayed)
  STAKERS: 0.20,         // 20% — unique staker diversity
  STABILITY: 0.25,       // 25% — sustained trust stability
  PRICE_RETENTION: 0.15, // 15% — price vs historical peak
} as const

// ─── Core ───

export interface CompositeTrustInput {
  weightedSignalRatio: number   // 0-100
  uniqueStakers: number
  stableDays: number
  currentPrice: number
  peakPrice: number
  recentSells: Array<{ shares: number; totalSupply: number; timestamp: string }>
}

/**
 * Composite trust score resistant to whale exits.
 * Blends time-decayed signal ratio, staker diversity,
 * stability duration, and price-retention into a single 0-100 score.
 */
export function calculateCompositeTrust(input: CompositeTrustInput): CompositeResult {
  const { weightedSignalRatio, uniqueStakers, stableDays, currentPrice, peakPrice } = input

  // 1. Signal ratio (already time-decayed by caller)
  const signalScore = Math.max(0, Math.min(100, weightedSignalRatio))

  // 2. Staker diversity — diminishing returns above 20 stakers
  const stakerScore = Math.min(100, (uniqueStakers / 20) * 100)

  // 3. Stability — days without trust score dropping below 50%
  const stabilityScore = Math.min(100, (stableDays / 30) * 100)

  // 4. Price retention vs all-time peak
  const priceRetentionRatio = peakPrice > 0 ? Math.min(1, currentPrice / peakPrice) : 1
  const priceScore = priceRetentionRatio * 100

  const score =
    signalScore   * COMPOSITE_WEIGHTS.SIGNAL_RATIO +
    stakerScore   * COMPOSITE_WEIGHTS.STAKERS +
    stabilityScore * COMPOSITE_WEIGHTS.STABILITY +
    priceScore    * COMPOSITE_WEIGHTS.PRICE_RETENTION

  return {
    score: Math.round(score * 100) / 100,
    breakdown: {
      signalScore: Math.round(signalScore),
      stakerScore: Math.round(stakerScore),
      stabilityScore: Math.round(stabilityScore),
      priceScore: Math.round(priceScore),
    },
    isStable: stableDays >= 7,
    priceRetentionRatio: Math.round(priceRetentionRatio * 100) / 100,
  }
}

/**
 * Count days where cumulative trust ratio stayed ≥50% (healthy zone).
 * Looks at the most recent consecutive stable window.
 */
export function calculateStableDays(
  signals: Array<{
    timestamp: string | number | Date
    side: 'support' | 'oppose'
    amount: number
    shares: number
  }>
): number {
  if (signals.length < 2) return 0

  // Oldest → newest
  const chronological = [...signals].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  const now = Date.now()
  let support = 0
  let oppose = 0
  let stableStartMs: number | null = null
  let totalStableDays = 0

  for (const sig of chronological) {
    const ts = new Date(sig.timestamp).getTime()
    if (sig.side === 'support') support += sig.amount
    else oppose += sig.amount

    const total = support + oppose
    const ratio = total > 0 ? (support / total) * 100 : 50

    if (ratio >= 50) {
      if (stableStartMs === null) stableStartMs = ts
    } else {
      if (stableStartMs !== null) {
        totalStableDays += (ts - stableStartMs) / (1000 * 60 * 60 * 24)
        stableStartMs = null
      }
    }
  }

  // Close out any open stable window
  if (stableStartMs !== null) {
    totalStableDays += (now - stableStartMs) / (1000 * 60 * 60 * 24)
  }

  return Math.max(0, Math.round(totalStableDays))
}

/**
 * Find the peak price reached based on support signal history.
 * Uses linear bonding curve: price = basePrice + slope * cumulativeShares
 */
export function findPeakPrice(
  supportSignals: Array<{ amount: number; shares: number }>,
  basePrice: number,
  slope: number
): number {
  let maxPrice = basePrice
  let cumulativeShares = 0

  for (const sig of supportSignals) {
    cumulativeShares = Math.max(0, cumulativeShares + sig.shares)
    const price = basePrice + slope * cumulativeShares
    if (price > maxPrice) maxPrice = price
  }

  return maxPrice
}

// ─── Gradual Exit Limit ───

const WHALE_THRESHOLD = 0.20   // >20% of total supply = whale
const MAX_DAILY_PCT   = 0.50   // Whales can sell max 50% of position per day

export interface ExitLimit {
  isLimited: boolean
  maxSellShares: number
  maxSellPercent: number   // integer (e.g. 50)
  reason: string
}

/**
 * Returns the maximum shares a user can sell today.
 * Whales (>20% ownership) are limited to 50% of their position.
 */
export function getMaxDailySell(userShares: number, totalSupply: number): ExitLimit {
  if (totalSupply <= 0 || userShares <= 0) {
    return { isLimited: false, maxSellShares: userShares, maxSellPercent: 100, reason: '' }
  }

  const ownershipPct = userShares / totalSupply
  if (ownershipPct < WHALE_THRESHOLD) {
    return { isLimited: false, maxSellShares: userShares, maxSellPercent: 100, reason: '' }
  }

  const maxShares = userShares * MAX_DAILY_PCT

  return {
    isLimited: true,
    maxSellShares: maxShares,
    maxSellPercent: Math.round(MAX_DAILY_PCT * 100),
    reason: `You own ${(ownershipPct * 100).toFixed(1)}% of supply. Gradual exit protects trust score.`,
  }
}

// ─── Sell Reason Config ───

export function getSellReasonConfig(id: SellReason): SellReasonConfig {
  return SELL_REASONS.find(r => r.id === id) ?? SELL_REASONS[0]
}

// ─── Loyalty Multiplier ───

export interface LoyaltyResult {
  multiplier: number                                    // 1.0 = no bonus, 1.5 = 50% bonus
  tier: 'bronze' | 'silver' | 'gold' | 'platinum'
  label: string
  color: string
  daysStaked: number
}

/**
 * Loyalty multiplier based on how long a user has been staked.
 * Longer-term stakers build a buffer that partially offsets trust-impact of selling.
 */
export function getLoyaltyMultiplier(stakedSince: string | number | Date | null): LoyaltyResult {
  if (!stakedSince) {
    return { multiplier: 1.0, tier: 'bronze', label: 'New Staker', color: '#cd7f32', daysStaked: 0 }
  }

  const daysStaked = Math.max(
    0,
    (Date.now() - new Date(stakedSince).getTime()) / (1000 * 60 * 60 * 24)
  )

  if (daysStaked >= 180) {
    return { multiplier: 1.5, tier: 'platinum', label: 'Platinum Loyalist', color: '#e5e4e2', daysStaked: Math.round(daysStaked) }
  }
  if (daysStaked >= 90) {
    return { multiplier: 1.3, tier: 'gold', label: 'Gold Supporter', color: '#f59e0b', daysStaked: Math.round(daysStaked) }
  }
  if (daysStaked >= 30) {
    return { multiplier: 1.15, tier: 'silver', label: 'Silver Backer', color: '#9ca3af', daysStaked: Math.round(daysStaked) }
  }
  return { multiplier: 1.0, tier: 'bronze', label: 'New Staker', color: '#cd7f32', daysStaked: Math.round(daysStaked) }
}
