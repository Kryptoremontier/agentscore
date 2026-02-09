export interface AgentVault {
  agentId: string

  // Bonding curve state
  totalShares: bigint               // Łączna liczba shares
  totalStaked: bigint               // Łączna ilość $TRUST w vault

  // Curve parameters
  basePrice: bigint                 // Cena początkowa za share
  exponent: number                  // Wykładnik krzywej (np. 1.5)

  // Positions
  positions: VaultPosition[]

  // Fees collected
  feesCollected: bigint
}

export interface VaultPosition {
  owner: `0x${string}`
  shares: bigint
  stakedAmount: bigint              // Ile $TRUST zainwestował
  entryPrice: bigint                // Średnia cena zakupu
  timestamp: Date
}

export interface StakeQuote {
  trustAmount: bigint               // Ile $TRUST chce stakować
  sharesReceived: bigint            // Ile shares dostanie
  pricePerShare: bigint             // Aktualna cena za share
  slippage: number                  // Estimated slippage %
  fee: bigint                       // Platform fee
}

export interface UnstakeQuote {
  sharesToSell: bigint
  trustReceived: bigint
  fee: bigint
  priceImpact: number               // % spadku ceny po transakcji
}

// Platform fees
export const PLATFORM_FEES = {
  agentRegistration: BigInt(0.01e18),   // 0.01 ETH
  stakingFee: 100,                       // 1% (basis points)
  unstakingFee: 150,                     // 1.5%
  minStake: BigInt(1e18),               // Min 1 $TRUST
}

// Bonding curve math
export function calculateSharePrice(
  totalShares: bigint,
  basePrice: bigint,
  exponent: number = 1.5
): bigint {
  if (totalShares === BigInt(0)) return basePrice
  const multiplier = Math.pow(Number(totalShares) / 1e18, exponent)
  return BigInt(Math.floor(Number(basePrice) * multiplier))
}

export function calculateSharesForStake(
  stakeAmount: bigint,
  totalShares: bigint,
  totalStaked: bigint,
  basePrice: bigint
): bigint {
  // Simplified: shares = stakeAmount / currentPrice
  const price = calculateSharePrice(totalShares, basePrice)
  return (stakeAmount * BigInt(1e18)) / price
}

export function calculateStakeForShares(
  sharesAmount: bigint,
  totalShares: bigint,
  basePrice: bigint
): bigint {
  const price = calculateSharePrice(totalShares, basePrice)
  return (sharesAmount * price) / BigInt(1e18)
}
