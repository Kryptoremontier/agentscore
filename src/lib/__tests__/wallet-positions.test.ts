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

describe('/agents, /skills and /claims all use the shared helpers (no page-local copies)', () => {
  it.each(['agents', 'skills', 'claims'])('/%s: user position, redeem shares and backers go through lib/wallet-positions.ts + lib/vault-positions.ts', async (page) => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync(`src/app/${page}/page.tsx`, 'utf8')
    const body = (name: string) => src.slice(src.indexOf(`const ${name} =`), src.indexOf('\n\n', src.indexOf(`const ${name} =`)))
    expect(body('fetchUserPosition')).toContain('fetchUserVaultPosition(')
    expect(body('fetchVaultSharesForUser')).toContain('fetchWalletShares(')
    expect(body('fetchAllPositions')).toContain('fetchVaultBackers(')
    // The copies: a lowercased `_eq` on account_id, a whole-vault read for one wallet, `limit: 100`.
    expect(src).not.toMatch(/account_id: \{ _eq: \$address \}/)
    expect(src).not.toMatch(/query GetVaultPositions\(\$termId/)
    expect(src).not.toMatch(/query GetAll(Positions)?\(/)
  })
})

describe('fetchUserVaultPosition / fetchWalletShares — lowercase input finds the checksummed row', () => {
  it('FOR and AGAINST in one request; lowercase wallet → found', async () => {
    const f = fake()
    const { fetchUserVaultPosition } = await import('../wallet-positions')
    const pos = await fetchUserVaultPosition(LUDA, LUDA_TRIPLE, HOLDER.toLowerCase())
    expect(pos.forShares).toBe('980000000000000')
    expect(pos.againstShares).toBeNull() // the holder has nothing on the other vault
    expect(f.calls).toHaveLength(1)
  })
  it('the redeem amount: lowercase wallet → its shares (was 0n past the first 100 rows of the vault)', async () => {
    fake()
    const { fetchWalletShares } = await import('../wallet-positions')
    expect(await fetchWalletShares(LUDA_TRIPLE, ATTESTER.toLowerCase())).toBe(20790000000000000n)
    expect(await fetchWalletShares(LUDA_TRIPLE, HOLDER.toLowerCase())).toBe(0n)
  })
  it('a failed read rejects (the page keeps what it showed), never "no position" / 0 shares', async () => {
    installFakeHasura({ tables: [], fail: () => 'throw' })
    const { fetchUserVaultPosition, fetchWalletShares } = await import('../wallet-positions')
    await expect(fetchUserVaultPosition(LUDA, null, HOLDER)).rejects.toThrow()
    await expect(fetchWalletShares(LUDA, HOLDER)).rejects.toThrow()
  })
})

describe('fetchVaultBackers — a vault with more than 100 positions', () => {
  it('pages past the 100-row cap: all 130 live backers, largest first (was `limit: 100`)', async () => {
    const VAULT = '0xvault'
    const rows = Array.from({ length: 130 }, (_, i) => ({
      id: `${VAULT}-1-${String(i).padStart(4, '0')}`, term_id: VAULT, account_id: `0x${String(i).padStart(40, '0')}`,
      shares: String(1000 + i), created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', account: { label: null },
    }))
    installFakeHasura({ tables: [{ match: (q) => q.includes('VaultPositions'), field: 'positions', rows }] })
    const { fetchVaultBackers } = await import('../vault-positions')
    const { positions, uniqueCount } = await fetchVaultBackers(VAULT, null)
    expect(positions).toHaveLength(130)
    expect(uniqueCount).toBe(130)
    expect(positions[0].shares).toBe('1129')
  })
  it('a failed read rejects — never an empty backers table', async () => {
    installFakeHasura({ tables: [], fail: () => 'throw' })
    const { fetchVaultBackers } = await import('../vault-positions')
    await expect(fetchVaultBackers('0xvault', null)).rejects.toThrow()
  })
})
