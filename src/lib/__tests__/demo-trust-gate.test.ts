/**
 * Etap 7 — `npm run demo:gate` (scripts/demo-trust-gate.ts): OPEN CLAW asks should_i_trust about
 * two real candidates and simulates the payment step. It must never pay, never send a request to an
 * agent, never invent an x402 endpoint, and refuse anything that isn't an allow.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

const DACKIE = '0x45078ae569def2264355f77e592028dd6f1f5d6373c204fe82bf3141ab1861fb'
const META = { dataAgeSeconds: 120, dataReadAt: '2026-10-18T17:26:31.357Z' }
const answers: Record<string, object> = {
  [DACKIE]: { decision: 'allow', reason: '1 person vouches for this agent in Crypto / Onchain; your policy needs at least 1.', areas: [{ area: 'Crypto / Onchain', people: 1, tTrust: '0.0099' }], meta: META },
}
const deny = { decision: 'deny', reason: 'No one vouches for this agent in Crypto / Onchain; your policy needs at least 1.', areas: [], meta: META }

async function runDemo(opts: { mcpDown?: boolean } = {}) {
  vi.resetModules()
  const calls: Array<{ url: string; body: any }> = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}'))
    calls.push({ url, body })
    if (url.endsWith('/api/mcp/mcp')) {
      if (opts.mcpDown) throw new TypeError('fetch failed')
      const answer = answers[body.params.arguments.agentId] ?? deny
      return new Response(`event: message\ndata: ${JSON.stringify({ result: { content: [{ type: 'text', text: JSON.stringify(answer) }] }, jsonrpc: '2.0', id: 1 })}\n\n`)
    }
    // The indexer: Dackie's listed link and its x402 tags (live 2026-10-18).
    return new Response(JSON.stringify({ data: { atoms: [{ value: { thing: { url: 'https://app.virtuals.io/virtuals/23397' } }, as_subject_triples: [{ predicate: { label: 'has tag' } }, { predicate: { label: 'compatible with' } }] }] } }))
  }))
  const lines: string[] = []
  vi.spyOn(console, 'log').mockImplementation((l = '') => { lines.push(String(l)) })
  const { run } = await import('../../../scripts/demo-trust-gate')
  await run
  return { out: lines.join('\n'), calls }
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('demo: OPEN CLAW chooses who to pay', () => {
  it('asks should_i_trust for both real candidates under { minPeople: 1, area: "Crypto / Onchain" }', async () => {
    const { calls, out } = await runDemo()
    const asked = calls.filter((c) => c.url.endsWith('/api/mcp/mcp'))
    expect(asked.map((c) => c.body.params)).toEqual([
      { name: 'should_i_trust', arguments: { agentId: DACKIE, minPeople: 1, area: 'Crypto / Onchain' } },
      { name: 'should_i_trust', arguments: { agentId: '0x330d423bea2a5eda264ea2a4eef3a5bdefba690de0023ac390936e7c3f17426c', minPeople: 1, area: 'Crypto / Onchain' } },
    ])
    expect(out).toContain('Summarise the latest Intuition testnet activity')
    expect(out).toMatch(/Captain Dackie\n {2}decision {2}ALLOW\n {2}reason {4}1 person vouches/)
    expect(out).toMatch(/AgentNews\n {2}decision {2}DENY/)
    expect(out).toContain('data      2 min old (read 2026-10-18T17:26:31.357Z)')
  })

  it('the payment step: nothing paid, nothing sent to an agent, no endpoint invented; the deny is refused with its reason', async () => {
    const { calls, out } = await runDemo()
    expect(out).toContain('Payment step — simulated: nothing is paid and no request is sent.')
    expect(out).toContain('POST <Captain Dackie\'s x402 endpoint — not published, so none is invented>')
    expect(out).toContain('(on Intuition: "has tag → x402", "compatible with → x402")')
    expect(out).toContain('its only listed link is https://app.virtuals.io/virtuals/23397')
    expect(out).toContain('AgentNews: Refused: No one vouches for this agent in Crypto / Onchain; your policy needs at least 1.')
    // Only AgentScore's MCP endpoint and the indexer are ever called — never an agent, never a payment.
    expect(new Set(calls.map((c) => new URL(c.url).pathname))).toEqual(new Set(['/api/mcp/mcp', '/v1/graphql']))
    expect(out).not.toMatch(/Error|at .*\.ts:\d+/) // reads as a screen recording: no stack traces
  })

  it('AgentScore unreachable → both unknown, both refused (no answer is not a yes)', async () => {
    const { out } = await runDemo({ mcpDown: true })
    expect(out.match(/decision {2}UNKNOWN/g)).toHaveLength(2)
    expect(out).toContain('Captain Dackie: Refused: No answer from AgentScore (fetch failed) — not a yes.')
    expect(out).not.toContain('allowed.')
  })

  it('runs with plain node (no TS runner dependency)', async () => {
    const { readFileSync } = await import('node:fs')
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
    expect(pkg.scripts['demo:gate']).toBe('node --experimental-strip-types --no-warnings scripts/demo-trust-gate.ts')
    expect(readFileSync('scripts/demo-trust-gate.ts', 'utf8')).not.toMatch(/^import /m)
  })
})
