/**
 * Etap 5b Run 1 commit 4 — names instead of hex. A person is their ENS name when one resolves
 * (the indexer's account label, as the Backers list read it), else the short hex; one cached
 * server helper; the UI renders the hex first and the name when it arrives.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { isEnsName, personName } from '../person-names'
import { resolvePersonNames, clearPersonNamesCache } from '../person-names-server'
import { PersonName } from '../../components/shared/PersonName'

const LUDAREP = '0x1392aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0006' // stands in for the live ludarep.eth wallet
const NO_ENS = '0x2c55ceea12675b91839585e8452b64a20841c3b8'

afterEach(() => { vi.unstubAllGlobals(); clearPersonNamesCache() })

function fakeAccounts(labels: Record<string, string>, fail = false) {
  const calls: Array<{ ids: string[] }> = []
  vi.stubGlobal('fetch', vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}'))
    calls.push({ ids: body.variables.ids })
    if (fail) throw new Error('indexer down')
    const accounts = (body.variables.ids as string[])
      .filter((id) => labels[id.toLowerCase()] !== undefined)
      .map((id) => ({ id, label: labels[id.toLowerCase()] }))
    return { ok: true, status: 200, json: async () => ({ data: { accounts } }) }
  }))
  return calls
}

describe('personName — ENS name, else the short hex', () => {
  it('an ENS label is the name; the indexer\'s short-hex label or nothing → the short hex', () => {
    expect(isEnsName('ludarep.eth')).toBe(true)
    expect(isEnsName('0x2c55...c3B8')).toBe(false)
    expect(isEnsName(null)).toBe(false)
    expect(personName(LUDAREP, 'ludarep.eth')).toBe('ludarep.eth')
    expect(personName(NO_ENS, '0x2c55...c3B8')).toBe('0x2c55...c3b8')
    expect(personName(NO_ENS)).toBe('0x2c55...c3b8')
  })
})

describe('resolvePersonNames — one cached server helper', () => {
  it('asks Hasura with CHECKSUMMED ids (a lowercase _in never matches), answers by lowercase wallet', async () => {
    const calls = fakeAccounts({ [LUDAREP]: 'ludarep.eth', [NO_ENS]: '0x2c55...c3B8' })
    const names = await resolvePersonNames([LUDAREP, NO_ENS.toUpperCase().replace('0X', '0x'), 'not-a-wallet'])
    expect(names).toEqual({ [LUDAREP]: 'ludarep.eth', [NO_ENS]: null })
    expect(calls).toHaveLength(1)
    expect(calls[0].ids).toContain('0x2c55cEEa12675B91839585E8452b64a20841c3B8')
  })
  it('caches names and no-names alike: the second ask makes no request', async () => {
    const calls = fakeAccounts({ [LUDAREP]: 'ludarep.eth' })
    await resolvePersonNames([LUDAREP, NO_ENS])
    expect(await resolvePersonNames([NO_ENS, LUDAREP])).toEqual({ [LUDAREP]: 'ludarep.eth', [NO_ENS]: null })
    expect(calls).toHaveLength(1)
  })
  it('a failed read answers nothing for those wallets (unknown, not "no name") and caches nothing', async () => {
    fakeAccounts({}, true)
    expect(await resolvePersonNames([LUDAREP])).toEqual({})
    const calls = fakeAccounts({ [LUDAREP]: 'ludarep.eth' })
    expect(await resolvePersonNames([LUDAREP])).toEqual({ [LUDAREP]: 'ludarep.eth' })
    expect(calls).toHaveLength(1)
  })
})

describe('<PersonName> — hex first, never waits on ENS', () => {
  it('first render: the short hex (title = the full wallet); a known ENS label renders at once', () => {
    expect(renderToStaticMarkup(createElement(PersonName, { wallet: NO_ENS }))).toContain('>0x2c55...c3b8<')
    expect(renderToStaticMarkup(createElement(PersonName, { wallet: NO_ENS }))).toContain(`title="${NO_ENS}"`)
    expect(renderToStaticMarkup(createElement(PersonName, { wallet: LUDAREP, label: 'ludarep.eth' }))).toContain('>ludarep.eth<')
  })
})

describe('every surface that shows a person goes through <PersonName> (source guards)', () => {
  const SRC = path.join(__dirname, '..', '..')
  const code = (f: string) => readFileSync(path.join(SRC, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  it.each([
    ['components/profile/AttestedDomains.tsx', 1], // who vouches, per area
    ['components/profile/AttestersAndBackers.tsx', 2], // people who vouch + backers
    ['components/profile/ReportsSection.tsx', 1],
    ['components/leaderboard/LeaderboardClient.tsx', 1],
    ['components/evaluators/EvaluatorsClient.tsx', 1],
    ['app/domains/page.tsx', 1],
    ['app/agents/page.tsx', 3], // the modal's People tab backers, its backers table, its activity
  ] as const)('%s', (f, n) => {
    const src = code(f)
    expect(src.match(/<PersonName wallet=/g)?.length).toBe(n)
    expect(src).not.toMatch(/truncateWallet\(|function shortAddr|\.includes\('\.eth'\)/)
  })
  it('the names route is internal (not under /api/v1) and reads through the one server helper', () => {
    const route = code('app/api/names/route.ts')
    expect(route).toMatch(/resolvePersonNames\(wallets\)/)
  })
})
