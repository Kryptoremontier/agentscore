/**
 * GraphQL transport + pager for the Intuition Hasura endpoint (REPO_MAP §7 rule 1).
 *
 * The endpoint caps every query at a fixed number of rows PER TABLE, whatever
 * `limit` asks for (testnet.intuition.sh, verified 2026-09-26):
 *   atoms / triples / signals → 250 rows, positions → 100 rows.
 * A query with `limit: 500` gets 250 back and nothing says so. "Fewer rows than
 * my limit" therefore does NOT mean "complete". /agents printed 249 of 263
 * ERC-8004 agents that way, reporting truncated: false.
 *
 * fetchAllRows pages with $limit/$offset until it has the aggregate `total` on
 * the SAME `where` (or, with no total, until an empty page), under a hard
 * ceiling. Only reaching the total, or an empty page, ends it; a short page
 * alone never does. Our own caps (e.g. the 500-agent cohort cap) are the
 * ceiling and stay reported as truncation. A server cap never truncates
 * silently.
 *
 * Failure is failure (§7 rule 5): a non-2xx response (the endpoint rate-limits
 * with HTTP 429 `{"message":"API rate limit exceeded"}`, no `errors`, no
 * `data`), GraphQL errors, or a body without `data` all throw. So does a page
 * failing mid-way. A partial list is never returned as if it were complete.
 */

import { APP_CONFIG } from './app-config'

/** Rows the endpoint returns per query, per root table, regardless of `limit`. */
export const SERVER_ROW_CAP = {
  atoms: 250,
  triples: 250,
  signals: 250,
  positions: 100,
} as const

/** 429 retries (one transport, so every caller backs off the same way). */
const RATE_LIMIT_RETRY_MS = [400, 1200] as const

export type GqlRequest = <T>(query: string, variables?: Record<string, unknown>) => Promise<T>

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * POST one GraphQL request. Throws on a non-2xx response (after two short
 * retries on 429), on GraphQL errors, and on a body without `data`. Never
 * returns empty data for a failed read.
 */
export async function gqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
  init?: { cache?: RequestCache; url?: string },
): Promise<T> {
  const url = init?.url ?? APP_CONFIG.GRAPHQL_URL
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(variables ? { query, variables } : { query }),
      ...(init?.cache ? { cache: init.cache } : {}),
    })
    if (res.ok === false) {
      if (res.status === 429 && attempt < RATE_LIMIT_RETRY_MS.length) {
        await sleep(RATE_LIMIT_RETRY_MS[attempt])
        continue
      }
      throw new Error(`GraphQL HTTP ${res.status}`)
    }
    const json = await res.json()
    if (json?.errors) throw new Error(json.errors[0]?.message || 'GraphQL error')
    if (json?.data == null) throw new Error('GraphQL response without data')
    return json.data as T
  }
}

export interface PagedRows<T> {
  rows: T[]
  /** Rows matching the `where` (from the aggregate, or from reading to the end); null = unknown. */
  total: number | null
  /** true = `rows` stops short of `total` (hit maxRows); null = unknown (ceiling hit, count failed). */
  truncated: boolean | null
}

export interface PageSpec {
  /**
   * Rows query. Must declare `$limit: Int!, $offset: Int!`, pass them to the
   * root field, and order by a UNIQUE key (term_id for atoms/triples, id for
   * positions/signals, as a tiebreaker if ordering by anything else). Without
   * one, offset pages can overlap or skip.
   */
  query: string
  /** Root field holding the rows, e.g. `triples`. */
  field: string
  /** Aggregate on the SAME `where`, `{ <countField> { aggregate { count } } }`. */
  countQuery?: string | null
  /** Root field of the count query, e.g. `triples_aggregate`. */
  countField?: string
  variables?: Record<string, unknown>
  /** Rows per request — at most the table's SERVER_ROW_CAP. */
  pageSize: number
  /** Our own ceiling. Reaching it with rows left is reported as truncated, never hidden. */
  maxRows: number
  /** Transport (injectable; defaults to gqlRequest). */
  request?: GqlRequest
}

/**
 * Read every row of a query, page by page. Throws if any page (or the
 * transport) fails — callers map that to their error state.
 */
export async function fetchAllRows<T>(spec: PageSpec): Promise<PagedRows<T>> {
  const request: GqlRequest = spec.request ?? gqlRequest
  const pageSize = Math.max(1, Math.floor(spec.pageSize))

  // The count runs alongside the first page. A failed count is "unknown", not 0:
  // paging then continues until an empty page proves the end.
  const countPromise: Promise<number | null> = spec.countQuery && spec.countField
    ? request<Record<string, { aggregate?: { count?: unknown } }>>(spec.countQuery, spec.variables)
        .then((d) => {
          const n = d?.[spec.countField!]?.aggregate?.count
          return typeof n === 'number' ? n : null
        })
        .catch(() => null)
    : Promise.resolve(null)

  const rows: T[] = []
  let reachedEnd = false
  // Bounded by maxRows: every page either adds at least one row or ends the read.
  while (rows.length < spec.maxRows) {
    const limit = Math.min(pageSize, spec.maxRows - rows.length)
    const data = await request<Record<string, T[]>>(spec.query, { ...spec.variables, limit, offset: rows.length })
    const batch = data?.[spec.field]
    if (!Array.isArray(batch)) throw new Error(`GraphQL response without ${spec.field}`)
    rows.push(...batch)
    if (batch.length === 0) { reachedEnd = true; break }
    const count = await countPromise
    if (count != null && rows.length >= count) { reachedEnd = true; break }
  }

  const count = await countPromise
  if (reachedEnd) {
    // Read to the end. A count a little off from a concurrent write doesn't turn into a false "truncated".
    const total = count == null ? rows.length : Math.max(count, rows.length)
    return { rows, total, truncated: total > rows.length }
  }
  // Stopped at maxRows before the end.
  if (count == null) return { rows, total: null, truncated: null }
  return { rows, total: count, truncated: count > rows.length }
}
