/**
 * Vault positions — the ONE positions read behind agent surfaces (atom vault,
 * trust counter-vault, report triples). The endpoint returns at most 100
 * positions per request whatever `limit` says; this reads every page up to the
 * aggregate count on the same `where` (lib/gql-pager.ts). A read that stops
 * short throws: a vault's positions are never a silent first 100.
 */

import { fetchAllRows, SERVER_ROW_CAP, type GqlRequest } from './gql-pager'
import { TRUST_PREDICATE_TERM_ID } from './gql-filters'
import { countLiveStakers, liveStakerWallets } from './live-position'

export interface VaultPosition {
  /** `${term_id}-${curve_id}-${account}` — unique and immutable, the paging key. */
  id?: string
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

// Pages are always read in `id` order — unique and immutable — and the requested order is
// applied after the full read. Paging on `shares` would skip or repeat a wallet whose shares
// change between two page requests (a trade mid-read), and still report the read complete.
function sharesOf(p: VaultPosition): bigint {
  try { return BigInt(p.shares || '0') } catch { return 0n }
}
const byId = (a: VaultPosition, b: VaultPosition) => ((a.id ?? '') < (b.id ?? '') ? -1 : (a.id ?? '') > (b.id ?? '') ? 1 : 0)
const COMPARE: Record<PositionOrder, (a: VaultPosition, b: VaultPosition) => number> = {
  id: byId,
  'shares-desc': (a, b) => {
    const x = sharesOf(a), y = sharesOf(b)
    return x === y ? byId(a, b) : x > y ? -1 : 1
  },
  'created-asc': (a, b) => ((a.created_at ?? '') < (b.created_at ?? '') ? -1 : (a.created_at ?? '') > (b.created_at ?? '') ? 1 : byId(a, b)),
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
    ? 'id term_id account_id shares created_at updated_at account { label }'
    : 'id term_id account_id shares'
  const page = await fetchAllRows<VaultPosition>({
    query: `
      query VaultPositions($vaultIds: [String!]!, $limit: Int!, $offset: Int!) {
        positions(
          where: { term_id: { _in: $vaultIds } }
          order_by: { id: asc }
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
  return options.order && options.order !== 'id' ? [...page.rows].sort(COMPARE[options.order]) : page.rows
}

/**
 * Live stakers per agent — distinct wallets with a live position on the atom vault or its trust
 * counter-vault (lib/live-position.ts countLiveStakers) — for surfaces that list agents without
 * reading their positions (global search, landing cards). One paged positions read. A
 * `counterId` left undefined is resolved from the agent's trust triple. Throws on a failed read.
 */
export async function fetchLiveStakerCounts(
  agents: ReadonlyArray<{ atomId: string; counterId?: string | null }>,
  options: { request?: GqlRequest } = {},
): Promise<Map<string, number>> {
  if (agents.length === 0) return new Map()
  const unresolved = agents.filter((a) => a.counterId === undefined).map((a) => a.atomId)
  const resolved = new Map<string, string | null>()
  if (unresolved.length > 0) {
    const page = await fetchAllRows<{ term_id: string; subject_id: string; counter_term_id: string | null }>({
      query: `
        query TrustCounterVaults($ids: [String!]!, $pred: String!, $limit: Int!, $offset: Int!) {
          triples(where: { subject_id: { _in: $ids }, predicate_id: { _eq: $pred } }, order_by: { term_id: asc }, limit: $limit, offset: $offset) {
            term_id subject_id counter_term_id
          }
        }
      `,
      field: 'triples',
      countQuery: `
        query TrustCounterVaultsCount($ids: [String!]!, $pred: String!) {
          triples_aggregate(where: { subject_id: { _in: $ids }, predicate_id: { _eq: $pred } }) { aggregate { count } }
        }
      `,
      countField: 'triples_aggregate',
      variables: { ids: unresolved, pred: TRUST_PREDICATE_TERM_ID },
      pageSize: SERVER_ROW_CAP.triples,
      maxRows: VAULT_POSITIONS_MAX,
      request: options.request,
    })
    if (page.truncated !== false) throw new Error('trust triples not read to the end')
    for (const t of page.rows) if (!resolved.has(t.subject_id)) resolved.set(t.subject_id, t.counter_term_id)
  }
  const withCounters = agents.map((a) => ({
    atomId: a.atomId,
    counterId: a.counterId === undefined ? (resolved.get(a.atomId) ?? null) : a.counterId,
  }))
  const positions = await fetchVaultPositions(
    withCounters.flatMap((a) => (a.counterId ? [a.atomId, a.counterId] : [a.atomId])),
    { request: options.request },
  )
  return new Map(withCounters.map((a) => [a.atomId, countLiveStakers(positions, a)]))
}

function parseShares(v: string | null | undefined): bigint {
  try { return BigInt(v || '0') } catch { return 0n }
}

/**
 * Per vault: summed shares and stakers — distinct wallets with a live position on that
 * vault (lib/live-position.ts). For triple vaults (skill / domain claims): a 0-share row
 * after a full redeem is not a staker. Grouped once; look up any vault id.
 */
export function vaultStakeStats(positions: readonly VaultPosition[]): (vaultId: string | null | undefined) => { totalShares: bigint; count: number } {
  const byVault = new Map<string, VaultPosition[]>()
  for (const p of positions) {
    if (!p?.term_id) continue
    const key = p.term_id.toLowerCase()
    const arr = byVault.get(key)
    if (arr) arr.push(p)
    else byVault.set(key, [p])
  }
  const stats = new Map<string, { totalShares: bigint; count: number }>()
  for (const [key, rows] of byVault) {
    stats.set(key, { totalShares: sumSharesByVault(rows).get(rows[0].term_id) ?? 0n, count: liveStakerWallets(rows, [key]).size })
  }
  return (vaultId) => (vaultId && stats.get(vaultId.toLowerCase())) || { totalShares: 0n, count: 0 }
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
