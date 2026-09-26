/**
 * One wallet's positions on given vaults — the connected user's own shares
 * (Back/Sell panel, redeem amount, "your position").
 *
 * Hasura stores `account_id` checksummed (EIP-55). An `_eq` on a lowercased
 * address never matches (CLAUDE.md "GraphQL quirks"): /agents' fetchUserPosition
 * did exactly that and always came back empty. `_ilike` without a wildcard is a
 * case-insensitive exact match, so any casing of the input finds the row — the
 * repo pattern (pnl-engine, evaluator-data, intuition). The input is validated as
 * an address first, so it can never carry a `%` / `_` wildcard.
 *
 * Throws on a failed read (lib/gql-pager.ts transport): a failure is not "no position".
 */

import { isAddress } from 'viem'
import { gqlRequest, type GqlRequest } from './gql-pager'

export interface WalletPosition {
  id: string
  term_id: string
  account_id: string
  shares: string
  curve_id?: string | number | null
  updated_at?: string | null
}

/** Positions per vault are one per bonding curve: a handful at most, never near the 100-row cap. */
const WALLET_POSITIONS_LIMIT = 100

export async function fetchWalletPositions(
  vaultIds: readonly string[],
  wallet: string,
  request: GqlRequest = gqlRequest,
): Promise<WalletPosition[]> {
  const ids = [...new Set(vaultIds.filter(Boolean))]
  if (ids.length === 0) return []
  if (!isAddress(wallet, { strict: false })) throw new Error(`not an address: ${wallet}`)
  const data = await request<{ positions: WalletPosition[] }>(
    `query WalletPositions($vaultIds: [String!]!, $account: String!, $limit: Int!) {
      positions(
        where: { term_id: { _in: $vaultIds }, account_id: { _ilike: $account } }
        order_by: { id: asc }
        limit: $limit
      ) { id term_id account_id shares curve_id updated_at }
    }`,
    { vaultIds: ids, account: wallet, limit: WALLET_POSITIONS_LIMIT },
  )
  return data.positions ?? []
}

/** The first position (by id: lowest curve) this wallet holds on one vault, among fetched rows. */
export function positionOn(positions: readonly WalletPosition[], vaultId: string): WalletPosition | null {
  const v = vaultId.toLowerCase()
  return positions.find((p) => p.term_id?.toLowerCase() === v) ?? null
}
