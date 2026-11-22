/**
 * Etap 9b — a failed fee read stops the dialog; it doesn't guess.
 *
 * getFeeConfig used to answer an invented fee (0.1 tTRUST fixed + 2.5%) when the FeeProxy couldn't
 * be read, and deposits were computed from it (REPO_MAP §7 rule 5: a failed read is never data).
 * Now: the fee is read live from the contract, a failed read throws, the dialog says "Can't read
 * the fee right now" with its sign button disabled, and no wallet window opens.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { parseEther, type PublicClient } from 'viem'
import { getFeeConfig, FeeReadError, FEE_CONFIG_TTL_MS, resetFeeConfigCacheForTests, depositToVault, type WriteConfig } from '../intuition'
import { previewAttestCost, mapWriteError, AttestError, type AttestPlan } from '../attest-service'
import { DEFAULT_TRUST_WEI } from '../agent-tier'
import { FEE_UNREAD } from '../people-copy'
import { AttestCostLine, FeeUnread } from '../../components/attest/AttestCost'

const SRC = path.join(__dirname, '..', '..')
const code = (f: string) => readFileSync(path.join(SRC, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

/** A public client whose FeeProxy answers `fees` (or fails when null). */
function client(fees: { fixedFee: bigint; bps: bigint } | null) {
  const readContract = vi.fn(async ({ functionName }: { functionName: string }) => {
    if (!fees) throw new Error('RPC down')
    if (functionName === 'depositFixedFee') return fees.fixedFee
    if (functionName === 'depositPercentageFee') return fees.bps
    throw new Error(`unexpected read ${functionName}`)
  })
  return { readContract, chain: { id: 13579 } } as unknown as PublicClient & { readContract: typeof readContract }
}
const LIVE = { fixedFee: parseEther('0.02'), bps: 250n } // what the FeeProxy answered on 2026-11-22
const PLAN: AttestPlan = { path: 'deposit', tripleId: `0x${'ab'.repeat(32)}`, missingAtoms: [] }

beforeEach(() => { resetFeeConfigCacheForTests(); vi.spyOn(console, 'warn').mockImplementation(() => {}) })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('getFeeConfig — the contract, or an error', () => {
  it('reads both values from the FeeProxy', async () => {
    expect(await getFeeConfig(client(LIVE))).toEqual(LIVE)
  })
  it('a failed read throws FeeReadError — no invented fee', async () => {
    await expect(getFeeConfig(client(null))).rejects.toBeInstanceOf(FeeReadError)
    expect(code('lib/intuition.ts')).not.toMatch(/FALLBACK_FIXED_FEE|FALLBACK_PERCENTAGE_BPS|using fallback/)
  })
  it('a failed read is never kept: the next read asks the contract again', async () => {
    await expect(getFeeConfig(client(null))).rejects.toBeInstanceOf(FeeReadError)
    const ok = client(LIVE)
    expect(await getFeeConfig(ok)).toEqual(LIVE)
    expect(ok.readContract).toHaveBeenCalledTimes(2)
  })
  it('a fee the admin changes on-chain shows within a minute — no code change (mocked fixed fee 0)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.UTC(2026, 10, 22, 12, 0))
    expect(await getFeeConfig(client(LIVE))).toEqual(LIVE)
    const changed = { fixedFee: 0n, bps: 250n }
    expect(await getFeeConfig(client(changed))).toEqual(LIVE) // the minute's read, kept
    vi.setSystemTime(Date.UTC(2026, 10, 22, 12, 0) + FEE_CONFIG_TTL_MS + 1)
    expect(await getFeeConfig(client(changed))).toEqual(changed)
    const preview = await previewAttestCost(client(changed), PLAN, DEFAULT_TRUST_WEI)
    expect(preview).toMatchObject({ fixedFeeWei: 0n, percentageFeeWei: parseEther('0.001'), totalWei: parseEther('0.041') })
    const html = renderToStaticMarkup(createElement(AttestCostLine, { preview }))
    expect(html).toContain('0.04 tTRUST behind it · fee 0.001 tTRUST · total 0.041 tTRUST, plus gas')
  })
})

describe('the dialog\'s cost, before the first wallet window', () => {
  it('read ok → the whole cost for a default trust: 0.04 behind it, fee 0.021, total 0.061, plus gas', async () => {
    const preview = await previewAttestCost(client(LIVE), PLAN, DEFAULT_TRUST_WEI)
    expect(preview).toMatchObject({ stakeWei: parseEther('0.04'), fixedFeeWei: parseEther('0.02'), percentageFeeWei: parseEther('0.001'), totalWei: parseEther('0.061'), txCount: 1 })
    const html = renderToStaticMarkup(createElement(AttestCostLine, { preview }))
    expect(html).toContain('data-testid="trust-cost-line"')
    expect(html).toContain('0.04 tTRUST behind it · fee 0.021 tTRUST · total 0.061 tTRUST, plus gas')
  })
  it('read failed → no preview: FEE_UNREAD, said plainly', async () => {
    const err = await previewAttestCost(client(null), PLAN, DEFAULT_TRUST_WEI).catch((e) => e)
    expect(err).toBeInstanceOf(AttestError)
    expect(err).toMatchObject({ code: 'FEE_UNREAD', message: FEE_UNREAD })
    expect(FEE_UNREAD).toBe('Can’t read the fee right now. Try again in a minute.')
    expect(mapWriteError(new FeeReadError('x'))).toMatchObject({ code: 'FEE_UNREAD' })
  })
  it('the dialog: the fee-unread state with a retry, and the sign button disabled without a preview', () => {
    const html = renderToStaticMarkup(createElement(FeeUnread, { onRetry: () => {} }))
    expect(html).toContain('data-testid="fee-unread"')
    expect(html).toContain('Can’t read the fee right now. Try again in a minute.')
    expect(html).toContain('>Try again</button>')
    const dialog = code('components/attest/AttestButton.tsx')
    expect(dialog).toMatch(/\{errorCode === 'FEE_UNREAD' && <FeeUnread onRetry=/)
    expect(dialog).toMatch(/disabled=\{!domain \|\| !stakeWei \|\| !preview \|\| wrongNetwork\}/)
    expect(dialog).toMatch(/\.catch\(err => \{\s*if \(cancelled\) return\s*setPreview\(null\)/) // a failed read leaves no stale preview
    expect(dialog).toMatch(/<AttestCostLine preview=\{preview\} \/>/)
  })
})

describe('no deposit from a guessed fee', () => {
  it('read failed → depositToVault opens no wallet window, the approval included', async () => {
    const writeContract = vi.fn()
    const config = {
      walletClient: { account: { address: '0x139219107C1eBE569f543C581b3B807Cf6740006' }, chain: { id: 13579 }, writeContract },
      publicClient: client(null),
      address: '0x2Ece8D4dEdcB9918A398528f3fa4688b1d2CAB91',
    } as unknown as WriteConfig
    await expect(depositToVault(config, PLAN.tripleId, DEFAULT_TRUST_WEI)).rejects.toBeInstanceOf(FeeReadError)
    expect(writeContract).not.toHaveBeenCalled()
  })
  it('the attest write path reads the fee before any write', () => {
    const svc = code('lib/attest-service.ts')
    const body = svc.slice(svc.indexOf('export async function attestAgentSkill'))
    const feeAt = body.indexOf('await getFeeConfig(config.publicClient)')
    expect(feeAt).toBeGreaterThan(0)
    for (const write of ['depositToVault(', 'createSimpleAtom(', 'createTriple(']) {
      expect(body.indexOf(write), write).toBeGreaterThan(feeAt)
    }
    const deposit = code('lib/intuition.ts')
    const fn = deposit.slice(deposit.indexOf('export async function depositToVault'))
    expect(fn.indexOf('await getFeeConfig(config.publicClient)')).toBeLessThan(fn.indexOf('await ensureFeeProxyApproved(config)'))
  })
})
