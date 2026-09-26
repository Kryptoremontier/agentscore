/**
 * Vault positions — the ONE positions read behind agent surfaces (atom vault,
 * trust counter-vault, report triples). The endpoint returns at most 100
 * positions per request whatever `limit` says; this reads every page up to the
 * aggregate count on the same `where` (lib/gql-pager.ts). A read that stops
 * short throws: a vault's positions are never a silent first 100.
 */

import { fetchAllRows, SERVER_ROW_CAP, type GqlRequest } from './gql-pager'

export interface VaultPosition {
  term_id: string
  account_id: string | null
  shares: string
  created_at?: string
  updated_at?: string
  account?: { label: string | null } | null
}

/** A row read with `withMeta: true`. */
export type VaultPositionWithMeta = VaultPosition & {
  created_at: string
  updated_at: string
  account: { label: string | null } | null
}

/** Our ceiling on one read (reported, never silent). Live agent vaults hold ≤ 4 rows (2026-09-26). */
export const VAULT_POSITIONS_MAX = 50_000

export type PositionOrder = 'id' | 'shares-desc' | 'created-asc'

// Every ordering ends on `id` (unique) so offset pages neither overlap nor skip.
const ORDER_BY: Record<PositionOrder, string> = {
  id: '{ id: asc }',
  'shares-desc': '[{ shares: desc }, { id: asc }]',
  'created-asc': '[{ created_at: asc }, { id: asc }]',
}

export interface FetchVaultPositionsOptions {
  order?: PositionOrder
  /** Also read `created_at` / `updated_at` / `account { label }`. */
  withMeta?: boolean
  request?: GqlRequest
}

/**
 * Every position on the given vaults. Throws on any failed page or when the
 * read can't reach the end; callers map that to their own failed state.
 */
export async function fetchVaultPositions(
  vaultIds: readonly string[],
  options: FetchVaultPositionsOptions & { withMeta: true },
): Promise<VaultPositionWithMeta[]>
export async function fetchVaultPositions(
  vaultIds: readonly string[],
  options?: FetchVaultPositionsOptions,
): Promise<VaultPosition[]>
export async function fetchVaultPositions(
  vaultIds: readonly string[],
  options: FetchVaultPositionsOptions = {},
): Promise<VaultPosition[]> {
  const ids = [...new Set(vaultIds.filter(Boolean))]
  if (ids.length === 0) return []
  const fields = options.withMeta
    ? 'term_id account_id shares created_at updated_at account { label }'
    : 'term_id account_id shares'
  const page = await fetchAllRows<VaultPosition>({
    query: `
      query VaultPositions($vaultIds: [String!]!, $limit: Int!, $offset: Int!) {
        positions(
          where: { term_id: { _in: $vaultIds } }
          order_by: ${ORDER_BY[options.order ?? 'id']}
          limit: $limit
          offset: $offset
        ) { ${fields} }
      }
    `,
    field: 'positions',
    countQuery: `
      query VaultPositionsCount($vaultIds: [String!]!) {
        positions_aggregate(where: { term_id: { _in: $vaultIds } }) { aggregate { count } }
      }
    `,
    countField: 'positions_aggregate',
    variables: { vaultIds: ids },
    pageSize: SERVER_ROW_CAP.positions,
    maxRows: VAULT_POSITIONS_MAX,
    request: options.request,
  })
  if (page.truncated !== false) throw new Error('vault positions not read to the end')
  return page.rows
}

function parseShares(v: string | null | undefined): bigint {
  try { return BigInt(v || '0') } catch { return 0n }
}

/** Sum of shares per vault (a 0-share row adds 0n, so the sum needs no live filter). */
export function sumSharesByVault(positions: readonly VaultPosition[]): Map<string, bigint> {
  const out = new Map<string, bigint>()
  for (const p of positions) {
    if (!p?.term_id) continue
    out.set(p.term_id, (out.get(p.term_id) ?? 0n) + parseShares(p.shares))
  }
  return out
}
