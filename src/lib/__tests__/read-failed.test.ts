/**
 * Etap 9d — a failed read is not "not found" (REPO_MAP §7 rule 5). Three states on every agent
 * surface: found; not found (the read succeeded and there is no such agent); couldn't read (the read
 * failed or timed out). The fake indexer fails → each surface says "couldn't read", REST answers 503
 * `read_failed`, MCP `read_failed`, the gate `unknown`; the agent truly missing → "not found" / 404.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { NextRequest } from 'next/server'
import { setDefaultCacheImplForTests } from '../server-cache'
import { fakeNextCache } from './fake-next-cache'
import { installFakeHasura, type FakeTable } from './fake-hasura'
import { lookupInList, lookupFromStatus } from '../agent-lookup'
import { resolveProfileAtom } from '../agent-profile'
import { checkCard } from '../check-data'
import { CouldNotRead } from '../../components/shared/CouldNotRead'
import { AGENT_UNREAD } from '../people-copy'

vi.mock('../on-chain-pricing', () => ({ getOnChainSharePrice: vi.fn(async () => null) }))
vi.mock('../evaluator-data', async (orig) => ({ ...(await orig<typeof import('../evaluator-data')>()), fetchEvaluatorLeaderboard: async () => [] }))

const SRC = path.join(__dirname, '..', '..')
const code = (f: string) => readFileSync(path.join(SRC, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const LUDA = '0x82d87d9517b68e653418c0e49805b36aca3e33a00536af25fc319f5c24802c5a'
const NOBODY = `0x${'0'.repeat(64)}`
const row = (term_id: string, label: string, shares: string) => ({
  term_id, label, data: null, type: 'Thing', emoji: null, created_at: '2026-03-01T00:00:00+00:00',
  creator: { label: 'x', id: '0x0' },
  positions_aggregate: { aggregate: { sum: { shares }, max: { created_at: '2026-03-01T00:00:00+00:00' } } },
  as_subject_triples: [],
})
const CORPUS = [row(LUDA, '{"name":"Luda"}', '980000000000000')]

const indexer = { down: false }
function tables(): FakeTable[] {
  return [
    { match: (q) => q.includes('ApiAgents'), field: 'atoms', rows: CORPUS },
    { match: (q) => q.includes('ApiAgent') && !q.includes('ApiAgents'), field: 'atoms', rows: [] },
    { match: (q) => q.includes('FindTrustTriple'), field: 'triples', rows: [] },
    { match: (q) => q.includes('GetAttestationTriple'), field: 'triples', rows: [] },
    { match: (q) => q.includes('VaultPositions'), field: 'positions', rows: [] },
    { match: (q) => /query GetErc8004Cohort[(R]/.test(q), field: 'triples', rows: [] },
    { match: (q) => q.includes('GetErc8004CohortCount'), field: 'triples', rows: [] },
    { match: (q) => q.includes('GetErc8004CohortAgent'), field: 'triples', rows: [] },
    { match: (q) => q.includes('GetCohortClassification'), field: 'triples', rows: [] },
    { match: (q) => q.includes('GetAgentAllTriples'), field: 'triples', rows: [] },
  ]
}

const clock = { t: Date.UTC(2026, 10, 23, 20, 20) }
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(clock.t)
  setDefaultCacheImplForTests(fakeNextCache(clock).impl)
  indexer.down = false
  installFakeHasura({
    tables: tables(),
    other: (q) => (q.includes('ResolveProfileAtom') ? { scoped: [], any: [] } : undefined),
    fail: () => (indexer.down ? 'throw' : undefined),
  })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => { setDefaultCacheImplForTests(null); vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks() })

async function agentRoute(id: string) {
  const { GET } = await import('@/app/api/v1/agents/[id]/route')
  const res = await GET(new NextRequest(`http://localhost/api/v1/agents/${id}`), { params: Promise.resolve({ id }) })
  return { status: res.status, cacheControl: res.headers.get('cache-control'), body: await res.json() }
}
async function mcp(name: string, args: Record<string, unknown>) {
  const { POST } = await import('@/app/api/mcp/[transport]/route')
  const res = await POST(new Request('http://localhost/api/mcp/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  }))
  const raw = await res.text()
  const rpc = JSON.parse(raw.includes('data:') ? raw.split('\n').find((l) => l.startsWith('data:'))!.slice(5) : raw)
  return { isError: !!rpc.result?.isError, text: (rpc.result?.content?.[0]?.text ?? '') as string }
}
async function gate(id: string) {
  const { GET } = await import('@/app/api/v1/agents/[id]/gate/route')
  const res = await GET(new NextRequest(`http://localhost/api/v1/agents/${id}/gate`), { params: Promise.resolve({ id }) })
  return (await res.json()).data as { decision: string }
}

describe('REST and MCP: a failed read is 503 read_failed, never 404', () => {
  it('the indexer fails and nothing is cached → /api/v1/agents/:id is 503 read_failed, no-store', async () => {
    indexer.down = true
    for (const id of [LUDA, NOBODY]) {
      const r = await agentRoute(id)
      expect(r.status, id).toBe(503)
      expect(r.body).toMatchObject({ success: false, error: 'read_failed' })
      expect(r.cacheControl).toBe('no-store')
    }
  })
  it('the agent truly missing → 404, as today; a listed agent → 200', async () => {
    expect((await agentRoute(NOBODY)).status).toBe(404)
    expect((await agentRoute(LUDA)).status).toBe(200)
  })
  it('MCP get_agent_trust: the indexer fails → read_failed (an error result), never "Agent not found"', async () => {
    indexer.down = true
    const r = await mcp('get_agent_trust', { agentId: NOBODY })
    expect(r.isError).toBe(true)
    expect(JSON.parse(r.text)).toMatchObject({ error: 'read_failed' })
    indexer.down = false
    expect((await mcp('get_agent_trust', { agentId: NOBODY })).text).toBe('Agent not found')
  })
  it('the gate keeps failing closed: unknown', async () => {
    indexer.down = true
    expect((await gate(LUDA)).decision).toBe('unknown')
    expect((await gate(NOBODY)).decision).toBe('unknown')
  })
  it('card, timeline and the modal\'s parts answer a failure the same way; the trust route already never 404s on one', () => {
    for (const f of ['app/api/v1/agents/[id]/card/route.ts', 'app/api/v1/agents/[id]/timeline/route.ts', 'app/api/v1/agents/page/[id]/route.ts']) {
      expect(code(f), f).toMatch(/catch \(error\) \{[\s\S]*return readFailedResponse\(\)/)
      expect(code(f), f).not.toMatch(/apiError\('Internal server error', 500\)/)
    }
    expect(code('app/api/mcp/[transport]/route.ts').match(/return mcpReadFailed\(error\)/g)).toHaveLength(3)
  })
})

describe('/check/[id]: couldn\'t read vs not found', () => {
  it('the indexer fails → unread (the "couldn\'t read" panel); up, an unknown id → not-found', async () => {
    indexer.down = true
    expect(await checkCard(NOBODY)).toBe('unread')
    indexer.down = false
    expect(await checkCard(NOBODY)).toBe('not-found')
    expect(code('app/check/[id]/page.tsx')).toMatch(/<CheckUnread attemptedAt=\{now\} \/>/)
  })
})

describe('/agents/[id]: couldn\'t read vs not found', () => {
  it('the profile lookup fails → status failed (it used to fall through to the scored API\'s 404)', async () => {
    indexer.down = true
    expect(await resolveProfileAtom(LUDA)).toEqual({ status: 'failed' })
    indexer.down = false
    expect(await resolveProfileAtom(NOBODY)).toEqual({ status: 'ok', inScope: false, atom: null })
  })
  it('the page: a failed lookup or a non-404 from our API → "couldn\'t read"; only a 404 is "not found"', () => {
    expect(lookupFromStatus(404)).toBe('not-found')
    for (const s of [500, 502, 503, 504]) expect(lookupFromStatus(s)).toBe('unread')
    const page = code('app/agents/[id]/page.tsx')
    expect(page).toMatch(/if \(resolved\.status === 'failed'\) throw new ReadFailed\(\)/)
    expect(page).toMatch(/if \(readFailedAt\) \{[\s\S]*<CouldNotRead attemptedAt=\{readFailedAt\}/)
  })
})

describe('the agent modal (`/agents?open=<id>`): couldn\'t read vs not found', () => {
  const ok = (ids: string[], truncated = false) => ({ status: 'ok' as const, rows: ids.map((term_id) => ({ term_id })), truncated }) as never
  const cohort = (ids: string[], truncated = false) => ({ status: 'ok' as const, agents: ids.map((termId) => ({ termId })), truncated }) as never
  it('in either list → found; both read to the end without it → not found; a failed or capped list → couldn\'t read', () => {
    expect(lookupInList({ agentScore: ok([LUDA]), cohort: cohort([]) }, LUDA)).toBe('found')
    expect(lookupInList({ agentScore: ok([]), cohort: cohort([NOBODY]) }, NOBODY)).toBe('found')
    expect(lookupInList({ agentScore: ok([LUDA]), cohort: cohort([]) }, NOBODY)).toBe('not-found')
    expect(lookupInList({ agentScore: { status: 'error' } as never, cohort: cohort([]) }, NOBODY)).toBe('unread')
    expect(lookupInList({ agentScore: ok([LUDA], true), cohort: cohort([]) }, NOBODY)).toBe('unread')
    expect(lookupInList(null, NOBODY)).toBe('unread')
  })
  it('the page shows the panel for "couldn\'t read" and a plain line for "not found"', () => {
    const page = code('app/agents/agents-client.tsx')
    expect(page).toMatch(/openLookup === 'unread' && \([\s\S]{0,40}<CouldNotRead attemptedAt=\{pageReadAt\}/)
    expect(page).toMatch(/openLookup === 'not-found' && \([\s\S]{0,200}AGENT_NOT_FOUND/)
  })
})

describe('the "couldn\'t read" panel', () => {
  it('says it is our read failing, not the agent missing; Try again; the time of the attempt', () => {
    const html = renderToStaticMarkup(createElement(CouldNotRead, { attemptedAt: '2026-11-23T20:20:20.653Z', onRetry: () => {} }))
    expect(AGENT_UNREAD).toBe('We couldn’t read this agent from Intuition right now. This is our read failing, not the agent missing.')
    expect(html).toContain(AGENT_UNREAD.replace(/’/g, '’'))
    expect(html).toContain('Try again')
    expect(html).toContain('Tried at 20:20:20 UTC')
    expect(html).toContain('dateTime="2026-11-23T20:20:20.653Z"')
  })
})
