/**
 * Etap 6 commit 1 — three seal slots show the path to Verified. Verified takes three people, so
 * the row always has three slots: one filled per distinct live person who vouches (the people
 * line's own rows, summarizeAttesters), most tTRUST first, the person by name (ENS, else the
 * short hex) and the area; open slots are dashed rings; more than three → three and "and N more";
 * a failed read → no slots at all.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { AttesterSummary } from '../agent-profile'
import { AGENT_TIER_LADDER } from '../agent-tier'
import { sealSlots, SEAL_SLOTS } from '../../components/agents/seal-slots'
import { SealRow } from '../../components/agents/SealRow'

const T = 10n ** 15n // 0.001 tTRUST
const person = (n: number, stake: bigint, domains = ['Knowledge / Productivity']): AttesterSummary => ({
  wallet: `0x${String(n).padStart(4, '0')}aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`,
  domains,
  totalStake: stake,
})
const NO_ENS = '0x2c55ceea12675b91839585e8452b64a20841c3b8'

const render = (attesters: AttesterSummary[] | null | undefined, size: 'sm' | 'md' | 'lg') =>
  renderToStaticMarkup(createElement(SealRow, { attesters, size }))
const seals = (html: string, kind: 'filled' | 'open' | 'more') => html.match(new RegExp(`data-seal="${kind}"`, 'g'))?.length ?? 0

describe('sealSlots — three slots, the path to Verified', () => {
  it('three, because Verified takes three people', () => {
    expect(SEAL_SLOTS).toBe(AGENT_TIER_LADDER.verified.minAttesters)
    expect(SEAL_SLOTS).toBe(3)
  })

  it.each([
    [0, 0, 3, 0],
    [1, 1, 2, 0],
    [3, 3, 0, 0],
    [5, 3, 0, 2],
  ])('%i people → %i filled, %i open, %i more', (n, filled, open, more) => {
    const s = sealSlots(Array.from({ length: n }, (_, i) => person(i, BigInt(n - i) * T)))
    expect(s.state).toBe('ok')
    if (s.state !== 'ok') return
    expect(s.filled).toHaveLength(filled)
    expect(s.open).toBe(open)
    expect(s.more).toBe(more)
    expect(s.total).toBe(n)
  })

  it('not read yet → loading; a failed read → unread (no slots), never three open ones', () => {
    expect(sealSlots(undefined)).toEqual({ state: 'loading' })
    expect(sealSlots(null)).toEqual({ state: 'unread' })
  })

  it('most tTRUST behind the vouch first, whatever order the rows came in; the input is not mutated', () => {
    const rows = [person(1, 2n * T), person(2, 9n * T), person(3, 5n * T), person(4, 1n * T)]
    const s = sealSlots(rows)
    if (s.state !== 'ok') throw new Error('expected ok')
    expect(s.filled.map((a) => a.totalStake)).toEqual([9n * T, 5n * T, 2n * T])
    expect(s.more).toBe(1)
    expect(rows.map((a) => a.totalStake)).toEqual([2n * T, 9n * T, 5n * T, 1n * T])
  })
})

describe('<SealRow> — the same slots at three sizes', () => {
  it.each(['sm', 'md', 'lg'] as const)('%s: 0 / 1 / 3 / 5 people', (size) => {
    const html = (n: number) => render(Array.from({ length: n }, (_, i) => person(i, BigInt(9 - i) * T)), size)
    expect([seals(html(0), 'filled'), seals(html(0), 'open')]).toEqual([0, 3])
    expect([seals(html(1), 'filled'), seals(html(1), 'open')]).toEqual([1, 2])
    expect([seals(html(3), 'filled'), seals(html(3), 'open'), seals(html(3), 'more')]).toEqual([3, 0, 0])
    expect([seals(html(5), 'filled'), seals(html(5), 'open'), seals(html(5), 'more')]).toEqual([3, 0, 1])
    expect(html(5)).toContain('and 2 more')
  })

  it('an open slot says "Open" (md, lg); the row names the count for screen readers', () => {
    expect(render([person(1, T)], 'lg')).toContain('>Open<')
    expect(render([person(1, T)], 'md')).toContain('Open')
    expect(render([], 'sm')).toContain('aria-label="Nobody vouches yet. Verified takes 3 people."')
    expect(render([person(1, T)], 'lg')).toContain('aria-label="1 person vouches. Verified takes 3 people."')
  })

  it.each(['sm', 'md', 'lg'] as const)('%s: a failed read draws no slots (the surface says it couldn’t read)', (size) => {
    const html = render(null, size)
    expect(html).toContain('data-state="unread"')
    expect(html).toContain('hidden')
    expect(seals(html, 'filled') + seals(html, 'open')).toBe(0)
    expect(html).not.toContain('Open')
  })

  it.each(['sm', 'md', 'lg'] as const)('%s: while loading, three placeholder rings — never three "Open"', (size) => {
    const html = render(undefined, size)
    expect(html).toContain('data-state="loading"')
    expect(seals(html, 'filled') + seals(html, 'open')).toBe(0)
    expect(html).not.toContain('Open')
  })

  it.each(['sm', 'md', 'lg'] as const)('%s: a person is named through <PersonName> — the short hex until a name resolves', (size) => {
    const html = render([{ wallet: NO_ENS, domains: ['Crypto / Onchain'], totalStake: T }], size)
    expect(html).toContain('>0x2c55...c3b8<')
    expect(html).toContain(`title="${NO_ENS}"`)
  })

  it('lg and md name the area under the person; sm carries it on hover', () => {
    const p = { wallet: NO_ENS, domains: ['Crypto / Onchain', 'Knowledge / Productivity'], totalStake: T }
    expect(render([p], 'lg')).toContain('>Crypto / Onchain · Knowledge / Productivity<')
    expect(render([p], 'md')).toContain('>Crypto / Onchain · Knowledge / Productivity<')
    expect(render([p], 'sm')).not.toContain('>Crypto / Onchain · Knowledge / Productivity<')
    expect(render([p], 'sm')).toContain('title="Crypto / Onchain · Knowledge / Productivity"')
  })
})

describe('where the seals are — beside the words, never instead of them (source guards)', () => {
  const SRC = path.join(__dirname, '..', '..')
  const code = (f: string) => readFileSync(path.join(SRC, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\{\s*\}/g, '')

  it('/agents: the grid card, the compact card and the list row (sm), next to the people line; the modal (lg)', () => {
    const page = code('app/agents/page.tsx')
    expect(page.match(/<SealRow attesters=\{sealsOf\(agent\.term_id\)\} size="sm"/g)).toHaveLength(3)
    expect(page.match(/<CardAttesterLine line=\{attesterLine\}/g)).toHaveLength(3)
    expect(page).toMatch(/<ProfileStatRow[\s\S]*?\/>\s*<SealRow attesters=\{modalAttesters\} size="lg"/)
  })

  it('/agents/[id]: under the stat row in both layouts (lg), the loading state until the profile is in', () => {
    const page = code('app/agents/[id]/page.tsx')
    expect(page.match(/<ProfileStatRow[^\n]*\/>\s*<SealRow attesters=\{profileLoading \? undefined : attesters\} size="lg"/g)).toHaveLength(2)
  })

  it('the landing example card (md), in place of the "by …" names — the same people, still the people line above', () => {
    const card = code('components/landing/ExampleAgentCard.tsx')
    expect(card).toMatch(/<SealRow attesters=\{agent\.attesters\} size="md"/)
    expect(card).toMatch(/agent\.line\.claim/)
  })
})
