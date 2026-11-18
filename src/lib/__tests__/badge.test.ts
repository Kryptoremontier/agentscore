/**
 * Etap 9 commit 3 — one badge for a README: GET /badge/<id>.svg →
 * "AgentScore · {tier label} · N people trust it · {age}". `Cache-Control: public, max-age=300`,
 * the data's age printed in the badge; a failed read is a grey "AgentScore · unknown" — never the
 * last numbers, never a guess.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { badgeSvg, badgeMessage, badgeAge, badgeLabel, badgePath, badgeSnippets, BADGE_CACHE_OK, type BadgeState } from '../badge'
import { calculateAgentTier } from '../agent-tier'
import type { AttesterSummary } from '../agent-profile'
import type { CheckCard, CheckResolution } from '../check-agent'
import { BuilderDoor } from '../../components/check/BuilderDoor'
import { SITE_URL } from '../site'

const SRC = path.join(__dirname, '..', '..')
const LUDA = '0x' + 'ab'.repeat(32)
const READ_AT = '2026-11-18T19:40:12.000Z'
const E18 = 10n ** 18n

const checkLookup = vi.fn<(raw: string) => Promise<{ resolution: CheckResolution; card: CheckCard | null }>>()
vi.mock('../check-data', () => ({ checkLookup: (raw: string) => checkLookup(raw) }))

const people = (n: number, each: bigint): AttesterSummary[] =>
  Array.from({ length: n }, (_, i) => ({ wallet: `0x${String(i + 1).padStart(40, '0')}`, domains: ['Social'], totalStake: each }))

function cardWith(attesters: AttesterSummary[] | null): CheckCard {
  return {
    id: LUDA, name: 'Luda', origin: 'agentscore',
    line: { kind: 'none', claim: null, cta: true, attesters: 0, domains: 0 } as unknown as CheckCard['line'],
    attesters, tier: attesters ? calculateAgentTier(attesters) : null,
    backing: null, backingTip: '', dataAgeSeconds: 30, dataReadAt: READ_AT,
  }
}
const found = (attesters: AttesterSummary[] | null) => ({ resolution: { status: 'found' as const, id: LUDA }, card: cardWith(attesters) })

async function get(id: string) {
  const { GET } = await import('@/app/badge/[id]/route')
  const res = await GET(new Request(`http://localhost/badge/${id}`), { params: { id } })
  return { res, svg: await res.text() }
}

beforeEach(() => checkLookup.mockReset())

describe('GET /badge/<id>.svg', () => {
  it('ok: "AgentScore · {tier label} · N people trust it · {age}", cached 5 minutes, the age printed in it', async () => {
    checkLookup.mockResolvedValue(found(people(3, E18 / 10n)))
    const { res, svg } = await get(`${LUDA}.svg`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/svg+xml; charset=utf-8')
    expect(res.headers.get('cache-control')).toBe('public, max-age=300')
    expect(BADGE_CACHE_OK).toBe('public, max-age=300')
    expect(checkLookup).toHaveBeenCalledWith(LUDA) // the .svg is the format, not the id
    expect(svg).toContain('aria-label="AgentScore · Verified · 3 people trust it · as of 2026-11-18 19:40 UTC"')
    expect(svg).toContain('>AgentScore</text>')
    expect(svg).toContain('>Verified · 3 people trust it · as of 2026-11-18 19:40 UTC</text>')
    expect(svg).toContain('data-state="ok"')
  })

  it('0 / 1 / 2 people: the tier rule\'s own answer, singular and plural', async () => {
    const said = async (attesters: AttesterSummary[]) => {
      checkLookup.mockResolvedValue(found(attesters))
      return (await get(`${LUDA}.svg`)).svg.match(/aria-label="([^"]*)"/)![1]
    }
    expect(await said([])).toBe('AgentScore · Unverified · 0 people trust it · as of 2026-11-18 19:40 UTC')
    expect(await said(people(1, E18))).toBe('AgentScore · Unverified · 1 person trusts it · as of 2026-11-18 19:40 UTC')
    expect(await said(people(2, E18 / 40n))).toBe('AgentScore · Established · 2 people trust it · as of 2026-11-18 19:40 UTC')
    // 2 people with too little tTRUST behind their trust: the rule says Unverified, and so does the badge.
    expect(await said(people(2, E18 / 100n))).toBe('AgentScore · Unverified · 2 people trust it · as of 2026-11-18 19:40 UTC')
  })

  it('a failed read → a grey "AgentScore · unknown": no tier, no number, no age', async () => {
    for (const answer of [
      { resolution: { status: 'unread' as const }, card: null }, // the list couldn't be read
      found(null),                                               // the agent is known, who trusts it is not
    ]) {
      checkLookup.mockResolvedValue(answer)
      const { res, svg } = await get(`${LUDA}.svg`)
      expect(res.status).toBe(200)
      expect(svg).toContain('aria-label="AgentScore · unknown"')
      expect(svg).toContain('fill="#6b7280"')
      expect(svg).not.toMatch(/people|person|Unverified|Established|Verified|as of|\d{4}-\d\d/)
      expect(res.headers.get('cache-control')).toBe('public, max-age=60')
    }
    // The lookup itself throwing is a failed read too.
    expect(readFileSync(path.join(SRC, 'lib/badge-data.ts'), 'utf8'))
      .toMatch(/await checkLookup\(raw\)\.catch\(\(\) => \(\{ resolution: \{ status: 'unread' as const \}, card: null \}\)\)/)
  })

  it('an unknown id → grey "AgentScore · not found" (a failed read is never this); a name that fits several says so', async () => {
    checkLookup.mockResolvedValue({ resolution: { status: 'not-found', query: { kind: 'name', name: 'nope' } }, card: null })
    const { res, svg } = await get('nope.svg')
    expect(res.status).toBe(200)
    expect(svg).toContain('aria-label="AgentScore · not found"')
    expect(svg).toContain('fill="#6b7280"')
    expect(svg).not.toMatch(/people|person|Unverified/)
    checkLookup.mockResolvedValue({ resolution: { status: 'choose', candidates: [], more: 0 }, card: null })
    expect((await get('agent.svg')).svg).toContain('aria-label="AgentScore · more than one agent"')
  })

  it('any id the /check box takes: an ERC-8004 id arrives percent-encoded or as typed', async () => {
    checkLookup.mockResolvedValue(found(people(1, E18)))
    await get('8453%3A1380.svg')
    expect(checkLookup).toHaveBeenLastCalledWith('8453:1380')
    await get('8453:1380.svg')
    expect(checkLookup).toHaveBeenLastCalledWith('8453:1380')
  })
})

describe('the drawing', () => {
  const ok: BadgeState = { kind: 'ok', tier: 'trusted', people: 2, readAt: READ_AT }
  it('the age is the read\'s absolute time — true however long a README keeps the picture', () => {
    expect(badgeAge(READ_AT)).toBe('as of 2026-11-18 19:40 UTC')
    expect(badgeAge('not a time')).toBe('')
    expect(badgeMessage(ok)).toBe('Established · 2 people trust it · as of 2026-11-18 19:40 UTC')
    expect(badgeLabel({ kind: 'unknown' })).toBe('AgentScore · unknown')
  })
  it('a well-formed, self-contained SVG: no script, no external reference, text fitted to its box', () => {
    const svg = badgeSvg(ok)
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
    expect(svg.endsWith('</svg>')).toBe(true)
    expect(svg).not.toMatch(/<script|href=|url\(http/i)
    expect(svg.match(/textLength="\d+"/g)).toHaveLength(2)
    const width = Number(svg.match(/width="(\d+)"/)![1])
    expect(width).toBeGreaterThan(300)
    expect(width).toBeLessThan(520)
  })
  it('each tier has its own colour; grey is only for "we can\'t say"', () => {
    const fill = (s: BadgeState) => badgeSvg(s).match(/<rect x="\d+"[^>]*fill="(#[0-9a-f]{6})"/)![1]
    const tiers = (['verified', 'trusted', 'unverified'] as const).map((tier) => fill({ kind: 'ok', tier, people: 3, readAt: READ_AT }))
    expect(new Set(tiers).size).toBe(3)
    expect(tiers).not.toContain('#6b7280')
    expect(fill({ kind: 'unknown' })).toBe('#6b7280')
  })
})

describe('on /check/[id]: copy-ready snippets', () => {
  it('Markdown and HTML: the badge, linking to the agent\'s card', () => {
    const { markdown, html } = badgeSnippets(SITE_URL, LUDA)
    expect(markdown).toBe(`[![AgentScore](${SITE_URL}/badge/${LUDA}.svg)](${SITE_URL}/check/${LUDA})`)
    expect(html).toBe(`<a href="${SITE_URL}/check/${LUDA}"><img src="${SITE_URL}/badge/${LUDA}.svg" alt="AgentScore" height="20"></a>`)
    expect(badgePath(LUDA)).toBe(`/badge/${LUDA}.svg`)
  })
  it('the builder\'s door shows the badge and both snippets', () => {
    const html = renderToStaticMarkup(createElement(BuilderDoor, { id: LUDA, name: 'Luda', people: 2, initialSlug: 'social' }))
    expect(html).toContain('data-testid="badge-snippets"')
    expect(html).toContain(`src="/badge/${LUDA}.svg"`)
    expect(html).toContain('data-testid="badge-markdown"')
    expect(html).toContain('data-testid="badge-html"')
    expect(html).toContain(`[![AgentScore](${SITE_URL}/badge/${LUDA}.svg)](${SITE_URL}/check/${LUDA})`)
  })
  it('the route only reads and draws: the /check lookup, no scoring of its own', () => {
    const route = readFileSync(path.join(SRC, 'app/badge/[id]/route.ts'), 'utf8')
    expect(route).toMatch(/export const dynamic = 'force-dynamic'/)
    const data = readFileSync(path.join(SRC, 'lib/badge-data.ts'), 'utf8')
    expect(data).toMatch(/await checkLookup\(raw\)/)
    expect(data).toMatch(/tier: card\.tier\.tier, people: card\.attesters\.length, readAt: card\.dataReadAt/)
  })
})
