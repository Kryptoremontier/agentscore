import { describe, it, expect, afterEach, vi } from 'vitest'
import { installFakeHasura } from './fake-hasura'
import { fetchWalletPositions, positionOn } from '../wallet-positions'

/**
 * The connected user's own position (Back/Sell panel, redeem amount). Hasura stores
 * account_id checksummed; /agents' fetchUserPosition filtered with a lowercased `_eq`
 * and never matched (live 2026-09-26: Luda's atom-vault holder 0xCbdE…FfEd and her
 * attester 0x1392…0006 both came back [] lowercased, found checksummed or via `_ilike`).
 */

const LUDA = '0x82d87d9517b68e653418c0e49805b36aca3e33a00536af25fc319f5c24802c5a'
const LUDA_TRIPLE = '0x54c64639c1f937890f5f67e65e9bcc708c5c6cce7cb9118c705c235c1fc94f75'
const HOLDER = '0xCbdE65F69574C94f0c3Ba7927E3D5Eb7d921FfEd' // checksummed, as the indexer stores it
const ATTESTER = '0x139219107C1eBE569f543C581b3B807Cf6740006'
const ROWS = [
  { id: `${LUDA}-1-${HOLDER}`, term_id: LUDA, account_id: HOLDER, shares: '980000000000000', curve_id: 1, updated_at: null },
  { id: `${LUDA_TRIPLE}-1-${ATTESTER}`, term_id: LUDA_TRIPLE, account_id: ATTESTER, shares: '20790000000000000', curve_id: 1, updated_at: null },
]

// The endpoint's `_ilike` without a wildcard: a case-insensitive exact match. `_eq`: exact.
function fake() {
  return installFakeHasura({
    tables: [{
      match: (q) => q.includes('WalletPositions'),
      field: 'positions',
      rows: (q, v) => ROWS.filter((r) => (v.vaultIds as string[]).includes(r.term_id) && (q.includes('_ilike')
        ? r.account_id.toLowerCase() === String(v.account).toLowerCase()
        : r.account_id === v.account)),
    }],
  })
}

afterEach(() => vi.unstubAllGlobals())

describe('fetchWalletPositions — the user finds their own position whatever the casing', () => {
  it('checksummed row, lowercase input (what the wallet hook gives) → found', async () => {
    fake()
    const rows = await fetchWalletPositions([LUDA], HOLDER.toLowerCase())
    expect(positionOn(rows, LUDA)?.shares).toBe('980000000000000')
  })
  it('mixed-case input → found', async () => {
    fake()
    const mixed = HOLDER.slice(0, 10).toUpperCase().replace('0X', '0x') + HOLDER.slice(10).toLowerCase()
    expect(positionOn(await fetchWalletPositions([LUDA], mixed), LUDA)?.shares).toBe('980000000000000')
  })
  it('another wallet → not found (no position, not someone else\'s)', async () => {
    fake()
    const rows = await fetchWalletPositions([LUDA], ATTESTER.toLowerCase())
    expect(positionOn(rows, LUDA)).toBeNull()
  })
  it('atom vault + triple vault in one read; each row lands on its own vault', async () => {
    fake()
    const rows = await fetchWalletPositions([LUDA, LUDA_TRIPLE], ATTESTER.toLowerCase())
    expect(positionOn(rows, LUDA)).toBeNull()
    expect(positionOn(rows, LUDA_TRIPLE)?.shares).toBe('20790000000000000')
  })
  it('matches with _ilike, never a lowercased _eq', async () => {
    const f = fake()
    await fetchWalletPositions([LUDA], HOLDER.toLowerCase())
    expect(f.calls[0].query).toMatch(/account_id: \{ _ilike: \$account \}/)
    expect(f.calls[0].query).not.toMatch(/account_id: \{ _eq/)
  })
  it('a non-address (e.g. a `%` wildcard) is refused before any request', async () => {
    const f = fake()
    await expect(fetchWalletPositions([LUDA], '%')).rejects.toThrow(/not an address/)
    expect(f.calls).toHaveLength(0)
  })
  it('a failed read rejects — never "no position"', async () => {
    installFakeHasura({ tables: [], fail: () => 'rate-limit' })
    await expect(fetchWalletPositions([LUDA], HOLDER)).rejects.toThrow()
  })
})

describe('/agents uses it at both call sites', () => {
  it('fetchUserPosition and fetchVaultSharesForUser read through fetchWalletPositions; no lowercased _eq on account_id', async () => {
    const { readFileSync } = await import('node:fs')
    const page = readFileSync('src/app/agents/page.tsx', 'utf8')
    const body = (name: string) => page.slice(page.indexOf(`const ${name} = async`), page.indexOf('\n  }\n', page.indexOf(`const ${name} = async`)))
    expect(body('fetchUserPosition')).toContain('fetchWalletPositions(')
    expect(body('fetchVaultSharesForUser')).toContain('fetchWalletPositions(')
    expect(page).not.toMatch(/account_id: \{ _eq: \$address \}/)
  })
})
