/**
 * Etap 9c — /admin/fees: the FeeProxy's fee and admins, read live; the fixed fee set from the
 * admin's own wallet. Signable only for a wallet the contract lists as an admin, never on a failed
 * read, and with exactly the calldata scripts/fee-calldata.ts prints.
 */
import { describe, it, expect, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import {
  fixedFeeForm, setFixedFeeTx, parseFeeInput, adminsFromEvents, readFeeAdmins, readFeeNow, feeTTrust, feePercent,
  FEE_FORM, SET_FIXED_FEE_GAS, type FeeRead,
} from '../fee-admin-reads'
import { FEE_PROXY, FEE_CHAIN_ID, FEE_ADMINS, FIXED_FEE_BEFORE_BETA_WEI } from '../fee-admin'

const ROOT = path.join(__dirname, '..', '..', '..')
const SRC = path.join(ROOT, 'src')
const code = (f: string) => readFileSync(path.join(SRC, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const FEE_OK: FeeRead = { status: 'ok', value: { fixedFee: 20_000_000_000_000_000n, bps: 250n }, readAt: 0 }
const base = { fee: FEE_OK, admin: 'yes' as const, input: '0', chainId: FEE_CHAIN_ID as number, pending: false }

/** The `data:` line scripts/fee-calldata.ts prints (no --check: it reads nothing, sends nothing). */
function scriptData(...args: string[]): string {
  const out = execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings', path.join(ROOT, 'scripts', 'fee-calldata.ts'), ...args], { encoding: 'utf8' })
  const m = out.match(/data:\s+(0x[0-9a-f]+)/)
  if (!m) throw new Error(`no data line in:\n${out}`)
  return m[1]
}

describe('the form: who may sign, and when', () => {
  it('an admin, the fee read, on Intuition Testnet, a new value → enabled', () => {
    const f = fixedFeeForm(base)
    expect(f.enabled).toBe(true)
    expect(f.reason).toBeNull()
    expect(f.newWei).toBe(0n)
  })
  it('non-admin → disabled, and says why', () => {
    const f = fixedFeeForm({ ...base, admin: 'no' })
    expect(f.enabled).toBe(false)
    expect(f.reason).toBe(FEE_FORM.notAdmin)
    for (const admin of ['checking', 'failed', 'disconnected'] as const) expect(fixedFeeForm({ ...base, admin }).enabled, admin).toBe(false)
  })
  it('read failed → disabled, no current value, no undo guessed', () => {
    const f = fixedFeeForm({ ...base, fee: { status: 'failed' } })
    expect(f.enabled).toBe(false)
    expect(f.reason).toBe(FEE_FORM.feeUnread)
    expect(f.undo).toBeNull()
    expect(fixedFeeForm({ ...base, fee: { status: 'reading' } }).enabled).toBe(false)
  })
  it('the same value, a bad amount, the wrong network or a pending send → disabled', () => {
    expect(fixedFeeForm({ ...base, input: '0.02' })).toMatchObject({ enabled: false, reason: FEE_FORM.same })
    expect(fixedFeeForm({ ...base, input: '-1' })).toMatchObject({ enabled: false, reason: FEE_FORM.badAmount })
    expect(fixedFeeForm({ ...base, input: 'abc' })).toMatchObject({ enabled: false, reason: FEE_FORM.badAmount })
    expect(fixedFeeForm({ ...base, input: '' })).toMatchObject({ enabled: false, reason: null })
    expect(fixedFeeForm({ ...base, chainId: 1 })).toMatchObject({ enabled: false, reason: FEE_FORM.wrongNetwork })
    expect(fixedFeeForm({ ...base, pending: true }).enabled).toBe(false)
  })
  it('before signing: the value now, the new one, and the undo (the value now) with its call', () => {
    const f = fixedFeeForm(base)
    expect(f.undo?.wei).toBe(20_000_000_000_000_000n)
    expect(f.undo?.tx.data).toBe(setFixedFeeTx(20_000_000_000_000_000n).data)
    expect(feeTTrust(20_000_000_000_000_000n)).toBe('0.02 tTRUST')
    expect(feeTTrust(0n)).toBe('0 tTRUST')
    expect(feePercent(250n)).toBe('2.5%')
    expect(parseFeeInput('0.02')).toBe(20_000_000_000_000_000n)
    expect(parseFeeInput('.5')).toBe(500_000_000_000_000_000n)
    expect(parseFeeInput('1e3')).toBeNull()
  })
})

describe('undo means the value before the change (Etap 9d)', () => {
  const ZERO: FeeRead = { status: 'ok', value: { fixedFee: 0n, bps: 250n }, readAt: 1 }
  it('0.02 → 0 signed in this visit: the fee now reads 0, the hint still says 0.02', () => {
    // What the owner saw: "Undo: set it back to 0 tTRUST: setDepositFixedFee(0)" — the new value.
    const after = fixedFeeForm({ ...base, fee: ZERO, input: '', previousWei: 20_000_000_000_000_000n })
    expect(after.undo?.wei).toBe(20_000_000_000_000_000n)
    expect(after.undo?.tx.data).toBe(setFixedFeeTx(20_000_000_000_000_000n).data)
    expect(fixedFeeForm({ ...base, fee: ZERO, input: '0.01', previousWei: 20_000_000_000_000_000n }).undo?.wei).toBe(20_000_000_000_000_000n)
  })
  it('a fresh page load (no change this visit): the hint says the value now', () => {
    expect(fixedFeeForm({ ...base, fee: ZERO, input: '0.01' }).undo?.wei).toBe(0n)
    expect(fixedFeeForm({ ...base, input: '' }).undo?.wei).toBe(20_000_000_000_000_000n)
  })
  it('the input equals the value now: no hint, and signing stays disabled', () => {
    const same = fixedFeeForm({ ...base, fee: ZERO, input: '0', previousWei: 20_000_000_000_000_000n })
    expect(same.undo).toBeNull()
    expect(same.enabled).toBe(false)
    expect(same.reason).toBe(FEE_FORM.same)
  })
  it('the page keeps the value read before its last signed change and passes it', () => {
    const client = readFileSync(path.join(SRC, 'components/admin/FeesAdminClient.tsx'), 'utf8')
    expect(client).toMatch(/fixedFeeForm\(\{[^}]*previousWei: done\?\.previous \?\? null \}\)/)
    expect(client).toMatch(/const previous = fee\.value\.fixedFee[\s\S]*setDone\(\{ hash, previous, next \}\)/)
  })
})

describe('the transaction: the runbook script\'s calldata, to the FeeProxy, explicit gas', () => {
  it('calldata matches scripts/fee-calldata.ts (the Beta change, the undo, any value)', () => {
    expect(fixedFeeForm(base).tx?.data).toBe(scriptData('fixed', '0'))
    expect(setFixedFeeTx(FIXED_FEE_BEFORE_BETA_WEI).data).toBe(scriptData('undo'))
    expect(fixedFeeForm({ ...base, input: '0.015' }).tx?.data).toBe(scriptData('fixed', '15000000000000000'))
  }, 20_000)
  it('to the FeeProxy, value 0, chain 13579, an explicit gas budget', () => {
    expect(setFixedFeeTx(0n)).toEqual({ to: FEE_PROXY, data: expect.stringMatching(/^0xf48371c0/), value: 0n, gas: SET_FIXED_FEE_GAS, chainId: 13579 })
  })
})

describe('the reads: live, and a failure is an error', () => {
  it('admins: the AdminWhitelistUpdated events replayed (last word per address), each confirmed on-chain now', async () => {
    expect(adminsFromEvents([
      { admin: FEE_ADMINS.adminWallet.toLowerCase(), status: true },
      { admin: FEE_ADMINS.feeRecipient, status: true },
      { admin: '0x000000000000000000000000000000000000dEaD', status: true },
      { admin: '0x000000000000000000000000000000000000dead', status: false },
    ])).toEqual([FEE_ADMINS.adminWallet, FEE_ADMINS.feeRecipient])

    const getLogs = vi.fn().mockResolvedValue([
      { args: { admin: FEE_ADMINS.adminWallet, status: true } },
      { args: { admin: FEE_ADMINS.feeRecipient, status: true } },
    ])
    const readContract = vi.fn(async ({ args }: { args: readonly [string] }) => args[0] === FEE_ADMINS.adminWallet)
    expect(await readFeeAdmins({ getLogs, readContract } as never)).toEqual([FEE_ADMINS.adminWallet])
    expect(getLogs.mock.calls[0][0]).toMatchObject({ address: FEE_PROXY, fromBlock: 0n })
    await expect(readFeeAdmins({ getLogs: vi.fn().mockRejectedValue(new Error('rpc')), readContract } as never)).rejects.toThrow()
  })
  it('the fee: both values from the contract, or an error — never a number', async () => {
    const readContract = vi.fn(async ({ functionName }: { functionName: string }) => (functionName === 'depositFixedFee' ? 20_000_000_000_000_000n : 250n))
    expect(await readFeeNow({ readContract } as never)).toEqual({ fixedFee: 20_000_000_000_000_000n, bps: 250n })
    await expect(readFeeNow({ readContract: vi.fn().mockRejectedValue(new Error('rpc')) } as never)).rejects.toThrow()
  })
})

describe('the page', () => {
  it('lives under /admin (behind AdminGuard), and is in the Admin nav', () => {
    expect(existsSync(path.join(SRC, 'app', 'admin', 'fees', 'page.tsx'))).toBe(true)
    expect(code('app/admin/layout.tsx')).toMatch(/<AdminGuard>\{children\}<\/AdminGuard>/)
    expect(code('components/layout/nav-items.ts')).toMatch(/href: '\/admin\/fees'/)
  })
  it('signs in the admin\'s own wallet through wagmi: no key, no server-side signing', () => {
    const client = code('components/admin/FeesAdminClient.tsx')
    expect(client).toMatch(/useSendTransaction\(\)/)
    expect(client).toMatch(/sendTransactionAsync\(\{ \.\.\.form\.tx, chainId: FEE_CHAIN_ID \}\)/)
    expect(client).toMatch(/disabled=\{!form\.enabled\}/)
    for (const f of ['components/admin/FeesAdminClient.tsx', 'lib/fee-admin-reads.ts', 'app/admin/fees/page.tsx']) {
      expect(code(f), f).not.toMatch(/privateKey|mnemonic|privateKeyToAccount|PRIVATE_KEY|signTransaction|process\.env/)
    }
    expect(existsSync(path.join(SRC, 'app', 'api', 'admin', 'fees'))).toBe(false)
  })
})
