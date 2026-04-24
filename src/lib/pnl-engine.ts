/**
 * PNL Engine
 *
 * Computes unrealized and realized P&L for evaluator positions using
 * on-chain cost basis from the positions table:
 *   total_deposit_assets_after_total_fees  — all-time deposits (cost basis)
 *   total_redeem_assets_for_receiver       — all-time redemptions (realized proceeds)
 *   vault.current_share_price              — current price per share (wei)
 *
 * Formula:
 *   currentValue  = shares × currentSharePrice
 *   unrealizedPNL = currentValue - costBasis
 *   realizedPNL   = realizedValue
 *   totalPNL      = unrealizedPNL + realizedPNL
 *   pnlPercent    = (totalPNL / costBasis) × 100
 */

import { APP_CONFIG } from './app-config'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PositionPNL {
  termId: string
  shares: number
  currentSharePrice: number
  currentValue: number
  costBasis: number
  realizedValue: number
  unrealizedPNL: number
  realizedPNL: number
  totalPNL: number
  pnlPercent: number
  isProfit: boolean
}

export interface WalletPNL {
  totalUnrealized: number
  totalRealized: number
  totalPNL: number
  totalCostBasis: number
  pnlPercent: number
  positions: PositionPNL[]
  profitablePositions: number
  totalPositions: number
  winRate: number
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function weiToFloat(wei: bigint): number {
  return Number(wei) / 1e18
}

function safeBigInt(s: string | null | undefined): bigint {
  try { return BigInt(s ?? '0') } catch { return 0n }
}

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(APP_CONFIG.GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  const json = await res.json()
  if (json.errors) throw new Error(json.errors[0]?.message || 'GraphQL error')
  return json.data as T
}

// ─── GraphQL query ────────────────────────────────────────────────────────────

const GET_WALLET_POSITIONS_WITH_PNL = `
  query GetWalletPositionsWithPNL($wallet: String!, $termIds: [String!]!) {
    positions(
      where: {
        account_id: { _ilike: $wallet }
        term_id: { _in: $termIds }
        shares: { _gt: "0" }
      }
    ) {
      term_id
      shares
      total_deposit_assets_after_total_fees
      total_redeem_assets_for_receiver
      vault {
        current_share_price
        total_shares
        total_assets
      }
    }
  }
`

type PosWithPNLRow = {
  term_id: string
  shares: string
  total_deposit_assets_after_total_fees: string
  total_redeem_assets_for_receiver: string
  vault: {
    current_share_price: string
    total_shares: string
    total_assets: string
  } | null
}

// ─── Core math (pure) ─────────────────────────────────────────────────────────

export function computePositionPNL(raw: {
  termId: string
  sharesStr: string
  costBasisStr: string
  realizedValueStr: string
  sharePriceStr: string
}): PositionPNL {
  const shares = weiToFloat(safeBigInt(raw.sharesStr))
  const currentSharePrice = weiToFloat(safeBigInt(raw.sharePriceStr))
  const costBasis = weiToFloat(safeBigInt(raw.costBasisStr))
  const realizedValue = weiToFloat(safeBigInt(raw.realizedValueStr))

  const currentValue = shares * currentSharePrice
  const unrealizedPNL = currentValue - costBasis
  const realizedPNL = realizedValue
  const totalPNL = unrealizedPNL + realizedPNL
  const pnlPercent = costBasis > 0 ? (totalPNL / costBasis) * 100 : 0

  return {
    termId: raw.termId,
    shares,
    currentSharePrice,
    currentValue,
    costBasis,
    realizedValue,
    unrealizedPNL,
    realizedPNL,
    totalPNL,
    pnlPercent,
    isProfit: totalPNL > 0,
  }
}

export function calculateWalletPNL(positions: PositionPNL[]): WalletPNL {
  const totalPositions = positions.length
  const profitablePositions = positions.filter(p => p.isProfit).length
  const totalUnrealized = positions.reduce((s, p) => s + p.unrealizedPNL, 0)
  const totalRealized = positions.reduce((s, p) => s + p.realizedPNL, 0)
  const totalPNL = totalUnrealized + totalRealized
  const totalCostBasis = positions.reduce((s, p) => s + p.costBasis, 0)
  const pnlPercent = totalCostBasis > 0 ? (totalPNL / totalCostBasis) * 100 : 0
  const winRate = totalPositions > 0 ? profitablePositions / totalPositions : 0

  return {
    totalUnrealized,
    totalRealized,
    totalPNL,
    totalCostBasis,
    pnlPercent,
    positions,
    profitablePositions,
    totalPositions,
    winRate,
  }
}

export function isProfitablePick(position: PositionPNL): boolean {
  return position.totalPNL > 0
}

// ─── Async fetch ──────────────────────────────────────────────────────────────

export async function fetchPositionPNL(
  wallet: string,
  termIds: string[],
): Promise<PositionPNL[]> {
  if (!wallet || termIds.length === 0) return []
  try {
    const data = await gql<{ positions: PosWithPNLRow[] }>(
      GET_WALLET_POSITIONS_WITH_PNL,
      { wallet: wallet.toLowerCase(), termIds },
    )
    return (data?.positions ?? []).map(p =>
      computePositionPNL({
        termId: p.term_id,
        sharesStr: p.shares,
        costBasisStr: p.total_deposit_assets_after_total_fees,
        realizedValueStr: p.total_redeem_assets_for_receiver,
        sharePriceStr: p.vault?.current_share_price ?? '0',
      })
    )
  } catch (e) {
    console.warn('[fetchPositionPNL] Failed — PNL unavailable, scoring falls back to trust score:', e)
    return []
  }
}
