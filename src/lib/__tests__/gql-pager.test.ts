import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchAllRows, gqlRequest, SERVER_ROW_CAP, type PageSpec } from '../gql-pager'
import { installFakeHasura } from './fake-hasura'

/**
 * REPO_MAP §7 rule 1 against the endpoint's own per-table row caps
 * (250 triples/atoms, 100 positions — verified live 2026-09-26). The fake
 * enforces those caps exactly like the endpoint: a `limit: 500` gets 250.
 */

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

const triples = (n: number) => Array.from({ length: n }, (_, i) => ({ term_id: `0x${String(i).padStart(4, '0')}` }))

const spec = (over: Partial<PageSpec> = {}): PageSpec => ({
  query: 'query T($limit: Int!, $offset: Int!) { triples(order_by: { term_id: asc }, limit: $limit, offset: $offset) { term_id } }',
  field: 'triples',
  countQuery: 'query TC { triples_aggregate { aggregate { count } } }',
  countField: 'triples_aggregate',
  pageSize: SERVER_ROW_CAP.triples,
  maxRows: 500,
  ...over,
})

describe('fetchAllRows — pages past the endpoint cap to the aggregate total', () => {
  it('264 rows at a 250 cap → two pages, all 264, not truncated', async () => {
    const fake = installFakeHasura({ tables: [{ match: () => true, field: 'triples', rows: triples(264) }] })
    const r = await fetchAllRows(spec())
    expect(r.rows).toHaveLength(264)
    expect(r).toMatchObject({ total: 264, truncated: false })
    expect(fake.rowCalls('triples').map((c) => c.variables.offset)).toEqual([0, 250])
  })

  it('a short page is NOT the end when the count says more (a smaller server cap than our page size)', async () => {
    // pageSize 250 but the table caps at 100: pages come back short and must keep going.
    installFakeHasura({ tables: [{ match: () => true, field: 'positions', rows: triples(230) }] })
    const r = await fetchAllRows(spec({
      query: 'query P($limit: Int!, $offset: Int!) { positions(order_by: { id: asc }, limit: $limit, offset: $offset) { term_id } }',
      field: 'positions',
      countQuery: 'query PC { positions_aggregate { aggregate { count } } }',
      countField: 'positions_aggregate',
      pageSize: 250,
    }))
    expect(r.rows).toHaveLength(230)
    expect(r.truncated).toBe(false)
  })

  it('count unavailable → reads until an EMPTY page; total is the rows read', async () => {
    const fake = installFakeHasura({
      tables: [{ match: () => true, field: 'triples', rows: triples(260), count: () => { throw new Error('count down') } }],
    })
    const r = await fetchAllRows(spec())
    expect(r.rows).toHaveLength(260)
    expect(r).toMatchObject({ total: 260, truncated: false })
    expect(fake.rowCalls('triples').map((c) => c.variables.offset)).toEqual([0, 250, 260])
  })

  it('our ceiling reached with rows left → truncated true with the real total', async () => {
    installFakeHasura({ tables: [{ match: () => true, field: 'triples', rows: triples(600) }] })
    const r = await fetchAllRows(spec({ maxRows: 500 }))
    expect(r.rows).toHaveLength(500)
    expect(r).toMatchObject({ total: 600, truncated: true })
  })

  it('exactly at the ceiling → not truncated', async () => {
    installFakeHasura({ tables: [{ match: () => true, field: 'triples', rows: triples(500) }] })
    expect(await fetchAllRows(spec({ maxRows: 500 }))).toMatchObject({ total: 500, truncated: false })
  })

  it('ceiling reached and the count failed → total and truncated unknown (null), never rows.length', async () => {
    installFakeHasura({
      tables: [{ match: () => true, field: 'triples', rows: triples(700), count: () => { throw new Error('count down') } }],
    })
    const r = await fetchAllRows(spec({ maxRows: 500 }))
    expect(r.rows).toHaveLength(500)
    expect(r).toMatchObject({ total: null, truncated: null })
  })

  it('a page failing mid-way throws — a partial list is never returned as complete', async () => {
    installFakeHasura({
      tables: [{ match: () => true, field: 'triples', rows: triples(400) }],
      fail: (q, v) => (!q.includes('_aggregate') && v.offset === 250 ? 'throw' : undefined),
    })
    await expect(fetchAllRows(spec())).rejects.toThrow()
  })

  it('a response without the rows field throws', async () => {
    installFakeHasura({ tables: [], other: () => ({ somethingElse: [] }) })
    await expect(fetchAllRows(spec({ countQuery: null }))).rejects.toThrow(/without triples/)
  })
})

describe('gqlRequest — failure is failure', () => {
  it('HTTP 429 (bare `{ message }`, no errors/data) retries, then throws — never empty data', async () => {
    vi.useFakeTimers()
    const fake = installFakeHasura({ tables: [], other: () => ({ atoms: [] }), fail: () => 'rate-limit' })
    const p = gqlRequest('{ atoms { term_id } }')
    const assertion = expect(p).rejects.toThrow('GraphQL HTTP 429')
    await vi.runAllTimersAsync()
    await assertion
    expect(fake.calls).toHaveLength(3) // 1 + 2 retries
  })

  it('HTTP 429 once, then OK → the retry succeeds', async () => {
    vi.useFakeTimers()
    installFakeHasura({ tables: [], other: () => ({ atoms: [{ term_id: '0x1' }] }), fail: (_q, _v, n) => (n === 0 ? 'rate-limit' : undefined) })
    const p = gqlRequest<{ atoms: unknown[] }>('{ atoms { term_id } }')
    await vi.runAllTimersAsync()
    expect((await p).atoms).toHaveLength(1)
  })

  it('GraphQL errors throw', async () => {
    installFakeHasura({ tables: [], fail: () => 'errors' })
    await expect(gqlRequest('{ atoms { term_id } }')).rejects.toThrow('boom')
  })

  it('a body without data throws', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ message: 'weird' }) })))
    await expect(gqlRequest('{ atoms { term_id } }')).rejects.toThrow(/without data/)
  })
})
