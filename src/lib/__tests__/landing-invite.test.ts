/**
 * Etap 6 commit 3 — the landing: an invitation under the one number, the tier rule in one line
 * after How it works' steps, and a "For developers" block that prints a REAL get_agent_trust
 * answer for the landing's example agent — its own field names, trimmed, with the data's age.
 *
 * Fixtures: the MCP endpoint's actual bodies on 2026-09-30 (a production build of main) for Luda
 * (scored, via AgentScore) and Captain Dackie (ERC-8004), byte for byte.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { invitationLine, LANDING_TIERS_LINE, DEV_LINE } from '../people-copy'
import { parseToolAnswer, trimAgentTrust, callLine, askAgentTrust, MCP_PATH, AGENT_TRUST_TOOL } from '../../components/landing/agent-answer'

const SRC = path.join(__dirname, '..', '..')
const code = (f: string) => readFileSync(path.join(SRC, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\{\s*\}/g, '')
const fixture = (name: string) => readFileSync(path.join(__dirname, 'fixtures', name), 'utf8')
const LUDA_BODY = fixture('mcp-get-agent-trust-luda.sse.txt')
const DACKIE_BODY = fixture('mcp-get-agent-trust-dackie.sse.txt')
const LUDA = '0x82d87d9517b68e653418c0e49805b36aca3e33a00536af25fc319f5c24802c5a'

afterEach(() => vi.unstubAllGlobals())

describe('the invitation under the one number', () => {
  it('one person → "Be the second."; any other count → "Add yours."; unread → nothing', () => {
    expect(invitationLine(1)).toBe('Be the second.')
    expect(invitationLine(0)).toBe('Add yours.')
    expect(invitationLine(2)).toBe('Add yours.')
    expect(invitationLine(40)).toBe('Add yours.')
    expect(invitationLine(null)).toBeNull()
  })

  it('N comes from /api/v1/stats (the number printed above it), never hard-coded — inside story part 4', () => {
    const hero = code('components/landing/Hero.tsx')
    expect(hero).toMatch(/const invitation = invitationLine\(people\.value\)/)
    const part4 = hero.slice(hero.indexOf('data-story="4"'), hero.indexOf('data-story="5"'))
    expect(part4).toContain('data-testid="people-vouching"')
    expect(part4).toContain('{invitation}')
    expect(hero).not.toMatch(/Be the second|Add yours/)
  })
})

describe('How it works: the tier rule in one line, after the steps', () => {
  it('the words from the spec', () => {
    expect(LANDING_TIERS_LINE).toBe('Trusted takes 2 people. Verified takes 3. Backing with tTRUST never changes the tier.')
  })
  it('rendered once, after the steps', () => {
    const how = code('components/landing/HowItWorks.tsx')
    expect(how.indexOf('{LANDING_TIERS_LINE}')).toBeGreaterThan(how.indexOf('steps.map('))
  })
})

describe('For developers — a real agent answer', () => {
  it('parses the MCP transport body (SSE) into the tool\'s JSON answer', () => {
    const luda = parseToolAnswer(LUDA_BODY)!
    expect((luda.agent as { name: string }).name).toBe('Luda')
    expect(luda.meta).toEqual({ dataAgeSeconds: 57, dataReadAt: '2026-09-30T19:43:47.981Z' })
    expect((parseToolAnswer(DACKIE_BODY)!.agent as { name: string }).name).toBe('Captain Dackie')
  })

  it('no answer is never an empty one: garbage, an error result or "Agent not found" → null', () => {
    expect(parseToolAnswer('')).toBeNull()
    expect(parseToolAnswer('data: {"result":{"content":[{"type":"text","text":"Agent not found"}]}}')).toBeNull()
    expect(parseToolAnswer('data: {"result":{"isError":true,"content":[{"type":"text","text":"{\\"agent\\":{}}"}]}}')).toBeNull()
  })

  it('trimmed, with the answer\'s own field names — a scored agent: tier, what the next rung needs, the data\'s age', () => {
    expect(trimAgentTrust(parseToolAnswer(LUDA_BODY)!)).toEqual({
      agent: { name: 'Luda', tier: 'unverified', tierBasis: 'attestations' },
      trustAnalysis: { tier: { current: 'unverified', nextTier: 'trusted', requirements: { attesters: '1/2', tTrustAttested: '0.0208/0.05 tTRUST' } } },
      meta: { dataAgeSeconds: 57, dataReadAt: '2026-09-30T19:43:47.981Z' },
    })
  })

  it('an ERC-8004 agent: its own shape, still its own names, still the age', () => {
    const t = trimAgentTrust(parseToolAnswer(DACKIE_BODY)!)
    expect(t.agent).toEqual({ name: 'Captain Dackie', origin: 'erc8004', trustTier: 'unverified', tierBasis: 'attestations', attesters: 1, tTrustAttested: 0.0099 })
    expect(Object.keys(t.meta as object)).toEqual(['dataAgeSeconds', 'dataReadAt'])
    expect(t.trustAnalysis).toBeUndefined()
  })

  it('every field it prints is one the real answer has — nothing renamed, nothing invented', () => {
    const paths = (o: unknown, p = ''): string[] => (o && typeof o === 'object' && !Array.isArray(o)
      ? Object.entries(o as object).flatMap(([k, v]) => [`${p}${k}`, ...paths(v, `${p}${k}.`)]) : [])
    for (const body of [LUDA_BODY, DACKIE_BODY]) {
      const real = new Set(paths(parseToolAnswer(body)))
      for (const f of paths(trimAgentTrust(parseToolAnswer(body)!))) expect(real.has(f), f).toBe(true)
    }
  })

  it('one tools/call to our own MCP endpoint', async () => {
    const calls: Array<{ url: string; body: { method: string; params: { name: string; arguments: { agentId: string } } } }> = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) })
      return { ok: true, text: async () => LUDA_BODY }
    }))
    expect(((await askAgentTrust(LUDA))!.agent as { name: string }).name).toBe('Luda')
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(MCP_PATH)
    expect(calls[0].body.method).toBe('tools/call')
    expect(calls[0].body.params).toEqual({ name: AGENT_TRUST_TOOL, arguments: { agentId: LUDA } })
  })

  it('a failed call → null (the block says it couldn\'t get an answer)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    expect(await askAgentTrust(LUDA)).toBeNull()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, text: async () => '' })))
    expect(await askAgentTrust(LUDA)).toBeNull()
  })

  it('the call line and the block\'s words', () => {
    expect(callLine(LUDA)).toBe('get_agent_trust({ agentId: "0x82d8…2c5a" })')
    expect(DEV_LINE).toBe('Your agent can ask before it trusts. Every answer carries the age of its data.')
  })

  it('asks about the Hero\'s own example agent, once in view, with a cancelled flag — and pitches nothing', () => {
    const dev = code('components/landing/ForDevelopers.tsx')
    expect(dev).toMatch(/useHeroAgent\(\)/)
    expect(dev).toMatch(/IntersectionObserver/)
    expect(dev).toMatch(/let cancelled = false[\s\S]*if \(cancelled\) return[\s\S]*return \(\) => \{ cancelled = true \}/)
    expect(code('components/landing/Hero.tsx')).toMatch(/setHeroAgent\(\{ termId: id, name \}\)/)
    expect(code('components/landing/Features.tsx')).toMatch(/<ForDevelopers /)
    expect(dev).not.toMatch(/\bearn\b|\bbuy\b|\bsell\b|\bgains?\b|tradeable/i)
  })
})
