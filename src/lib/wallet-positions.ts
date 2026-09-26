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

/** The connected wallet's own shares on a vault (FOR) and its counter-vault (AGAINST). */
export interface UserVaultPosition {
  /** Live shares (> 0) on the vault, else null. */
  forShares: string | null
  againstShares: string | null
  rawPositions: WalletPosition[]
  againstRawPositions: WalletPosition[]
}

const liveShares = (raw: string | undefined): string | null => {
  try { return raw && BigInt(raw) > 0n ? raw : null } catch { return null }
}

/**
 * The /agents, /skills and /claims "your position": one request for both vaults (the pages each
 * had a copy doing two lowercase `_eq` reads that never matched). Throws on a failed read — the
 * page keeps what it showed; a failure is not "no position".
 */
export async function fetchUserVaultPosition(
  termId: string,
  counterTermId: string | null | undefined,
  wallet: string,
  request: GqlRequest = gqlRequest,
): Promise<UserVaultPosition> {
  const rows = await fetchWalletPositions(counterTermId ? [termId, counterTermId] : [termId], wallet, request)
  const on = (id: string) => rows.filter((r) => r.term_id?.toLowerCase() === id.toLowerCase())
  const rawPositions = on(termId)
  const againstRawPositions = counterTermId ? on(counterTermId) : []
  return {
    forShares: liveShares(rawPositions[0]?.shares),
    againstShares: liveShares(againstRawPositions[0]?.shares),
    rawPositions,
    againstRawPositions,
  }
}

/**
 * This wallet's shares on one vault (0n = none) — the redeem amount. Only its own rows, in one
 * request: reading the whole vault stopped at 100 rows (a redeem could read 0 on a larger vault).
 * Throws on a failed read.
 */
export async function fetchWalletShares(termId: string, wallet: string, request: GqlRequest = gqlRequest): Promise<bigint> {
  const pos = positionOn(await fetchWalletPositions([termId], wallet, request), termId)
  try { return pos?.shares ? BigInt(pos.shares) : 0n } catch { return 0n }
}
