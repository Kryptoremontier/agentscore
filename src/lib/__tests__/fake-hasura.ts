/**
 * Test double for the Intuition Hasura endpoint that behaves like the real one
 * where it matters for paging (verified live 2026-09-26):
 *   - every rows query is capped per table (SERVER_ROW_CAP: 250 triples/atoms,
 *     100 positions) whatever `limit` asks for;
 *   - `limit` / `offset` variables are honoured;
 *   - `<table>_aggregate { aggregate { count } }` answers the table's count;
 *   - rate limiting is a bare HTTP 429 `{ "message": … }` — no `errors`, no `data`.
 * Not a test file (no `.test.ts`), so vitest doesn't collect it.
 */
import { vi } from 'vitest'
import { SERVER_ROW_CAP } from '../gql-pager'

type Vars = Record<string, unknown>
type Table = keyof typeof SERVER_ROW_CAP

export interface FakeTable {
  /** Does this query read this table? (by operation name / content) */
  match: (query: string, variables: Vars) => boolean
  field: Table
  rows: unknown[] | ((query: string, variables: Vars) => unknown[])
  /** Aggregate answer; defaults to the row count. Throw to simulate a failed count. */
  count?: number | ((query: string, variables: Vars) => number)
}

export interface FakeHasuraOptions {
  tables: FakeTable[]
  /** Answer anything the tables don't match (return the `data` object), or undefined. */
  other?: (query: string, variables: Vars) => unknown
  /** Per request: 'rate-limit' → HTTP 429, 'throw' → network error, 'errors' → GraphQL errors. */
  fail?: (query: string, variables: Vars, requestIndex: number) => 'rate-limit' | 'throw' | 'errors' | undefined
}

export interface FakeHasura {
  calls: Array<{ query: string; variables: Vars }>
  /** Row requests (not aggregates) against a table, in order. */
  rowCalls: (field: Table) => Array<{ query: string; variables: Vars }>
}

const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ data }) })

export function installFakeHasura(opts: FakeHasuraOptions): FakeHasura {
  const calls: FakeHasura['calls'] = []
  vi.stubGlobal('fetch', vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}'))
    const query = String(body.query)
    const variables: Vars = body.variables ?? {}
    calls.push({ query, variables })
    const failure = opts.fail?.(query, variables, calls.length - 1)
    if (failure === 'throw') throw new Error('network down')
    if (failure === 'rate-limit') {
      return { ok: false, status: 429, json: async () => ({ message: 'API rate limit exceeded' }) }
    }
    if (failure === 'errors') return { ok: true, status: 200, json: async () => ({ errors: [{ message: 'boom' }] }) }

    for (const t of opts.tables) {
      if (!t.match(query, variables)) continue
      const all = typeof t.rows === 'function' ? t.rows(query, variables) : t.rows
      if (query.includes(`${t.field}_aggregate`)) {
        const count = typeof t.count === 'function' ? t.count(query, variables) : t.count ?? all.length
        return ok({ [`${t.field}_aggregate`]: { aggregate: { count } } })
      }
      const offset = typeof variables.offset === 'number' ? variables.offset : 0
      const limit = typeof variables.limit === 'number' ? variables.limit : Infinity
      const n = Math.min(limit, SERVER_ROW_CAP[t.field])
      return ok({ [t.field]: all.slice(offset, offset + n) })
    }
    const data = opts.other?.(query, variables)
    if (data === undefined) throw new Error(`fake-hasura: unmatched query ${query.slice(0, 120)}`)
    return ok(data)
  }))
  return {
    calls,
    rowCalls: (field) => calls.filter((c) => new RegExp(`\\b${field}\\s*\\(`).test(c.query) && !c.query.includes(`${field}_aggregate`)),
  }
}
