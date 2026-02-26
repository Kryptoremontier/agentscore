/**
 * Bonding Curve Math — UI preview only.
 *
 * Linear model: price = BASE_PRICE + SLOPE * supply
 * Real execution still goes through Intuition's MultiVault contract.
 */

export const BONDING_CURVE_CONFIG = {
  BASE_PRICE: 0.001,   // tTRUST per share at supply = 0
  SLOPE: 0.0005,       // price increase per share
  PROTOCOL_FEE: 0.05,  // 5 %
} as const

/** Marginal price at a given supply level */
export function getCurrentPrice(totalSupply: number): number {
  return BONDING_CURVE_CONFIG.BASE_PRICE + BONDING_CURVE_CONFIG.SLOPE * totalSupply
}

/**
 * How many shares you get for a given tTRUST amount (after fee).
 *
 * Cost of N shares starting at supply S:
 *   C(N) = BASE_PRICE * N + SLOPE * (S * N + N²/2)
 *
 * Solving for N given amount A:
 *   SLOPE/2 * N² + (BASE_PRICE + SLOPE * S) * N - A = 0
 *   N = (-b + sqrt(b² + 2 * SLOPE * A)) / SLOPE
 *   where b = BASE_PRICE + SLOPE * S
 */
export function getSharesForAmount(amount: number, supply: number): number {
  if (amount <= 0) return 0
  const { BASE_PRICE, SLOPE } = BONDING_CURVE_CONFIG
  const b = BASE_PRICE + SLOPE * supply
  const discriminant = b * b + 2 * SLOPE * amount
  if (discriminant < 0) return 0
  return (-b + Math.sqrt(discriminant)) / SLOPE
}

/** Cost to buy N shares starting at given supply */
export function getBuyCost(shares: number, supply: number): number {
  if (shares <= 0) return 0
  const { BASE_PRICE, SLOPE } = BONDING_CURVE_CONFIG
  return BASE_PRICE * shares + SLOPE * (supply * shares + (shares * shares) / 2)
}

/** Proceeds from selling N shares starting at given supply */
export function getSellProceeds(shares: number, supply: number): number {
  if (shares <= 0 || supply <= 0) return 0
  const effectiveShares = Math.min(shares, supply)
  const newSupply = supply - effectiveShares
  const { BASE_PRICE, SLOPE } = BONDING_CURVE_CONFIG
  // Integral from newSupply to supply
  return BASE_PRICE * effectiveShares + SLOPE * (supply * effectiveShares - (effectiveShares * effectiveShares) / 2)
}

/** Full buy calculation with fee */
export function calculateBuy(amountTrust: number, supply: number) {
  if (amountTrust <= 0) return {
    fee: 0, netAmount: 0, sharesReceived: 0,
    avgPricePerShare: 0, newSupply: supply, newPrice: getCurrentPrice(supply),
  }
  const fee = amountTrust * BONDING_CURVE_CONFIG.PROTOCOL_FEE
  const netAmount = amountTrust - fee
  const sharesReceived = getSharesForAmount(netAmount, supply)
  const avgPricePerShare = sharesReceived > 0 ? netAmount / sharesReceived : 0
  const newSupply = supply + sharesReceived
  const newPrice = getCurrentPrice(newSupply)
  return { fee, netAmount, sharesReceived, avgPricePerShare, newSupply, newPrice }
}

/** Full sell calculation with fee */
export function calculateSell(shares: number, supply: number) {
  if (shares <= 0 || supply <= 0) return {
    grossProceeds: 0, fee: 0, netProceeds: 0,
    newSupply: supply, newPrice: getCurrentPrice(supply),
  }
  const grossProceeds = getSellProceeds(shares, supply)
  const fee = grossProceeds * BONDING_CURVE_CONFIG.PROTOCOL_FEE
  const netProceeds = grossProceeds - fee
  const effectiveShares = Math.min(shares, supply)
  const newSupply = supply - effectiveShares
  const newPrice = getCurrentPrice(newSupply)
  return { grossProceeds, fee, netProceeds, newSupply, newPrice }
}

/** Generate chart data points for the bonding curve */
export function generateCurveData(
  currentSupply: number,
  points = 50,
): { supply: number; price: number }[] {
  // Show curve from 0 to 2x current supply (min 20 for empty vaults)
  const maxSupply = Math.max(currentSupply * 2, 20)
  const step = maxSupply / points
  const data: { supply: number; price: number }[] = []
  for (let i = 0; i <= points; i++) {
    const s = i * step
    data.push({ supply: parseFloat(s.toFixed(4)), price: parseFloat(getCurrentPrice(s).toFixed(6)) })
  }
  return data
}

/** Calculate PnL for a position */
export function calculatePositionPnL(
  shares: number,
  invested: number,
  supply: number,
) {
  const currentValue = getSellProceeds(shares, supply)
  const pnl = currentValue - invested
  const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0
  return { currentValue, pnl, pnlPercent }
}
