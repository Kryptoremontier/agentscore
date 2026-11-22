/**
 * Etap 9c — "Your trust": a person can take their trust back.
 *
 * The block lists this wallet's trust in the agent (one row per trust context), hides itself when
 * there is none, never lets a withdrawal be signed without the contract's preview, and withdraws
 * with a redeem straight on MultiVault — never through the FeeProxy.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const gql = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('../gql-pager', async (orig) => ({ ...(await orig<typeof import('../gql-pager')>()), gqlRequest: gql.request }))

import { rowsFromIndex, readYourTrust, previewWithdraw, withdrawTrust, type YourTrustRow } from '../your-trust'
import { YourTrustView, canSignWithdraw, rowKey, type YourTrustViewProps } from '../../components/trust/YourTrust'
import { createWriteConfig, getMultiVaultAddress, FEE_PROXY_ADDRESS } from '../intuition'
import { CANONICAL_DOMAINS_REGISTRY, IS_SKILLED_IN } from '../canonical-domains'
import * as copy from '../people-copy'

const SRC = path.join(__dirname, '..', '..')
const code = (f: string) => readFileSync(path.join(SRC, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const SOCIAL = CANONICAL_DOMAINS_REGISTRY.find((d) => d.label === 'Social')!
const CODING = CANONICAL_DOMAINS_REGISTRY.find((d) => d.label === 'AI / Coding')!
const LUDA = '0x82d87d9517b68e653418c0e49805b36aca3e33a00536af25fc319f5c24802c5a'
const LUDA_SOCIAL = '0x8e7d947179f66267300ba40378dc9b0816a2046fe9d39cc88c1dad60919ee428' as const
const LUDA_CODING = '0xad49d67057f1da418b93346acaa44246772c00a59706e362a5ed42aa20c7fce9' as const
const OWNER_TEST_WALLET = '0xCCA0592b0bf23C10aFc58f65d28eE8C0E78aA21C'
const CHAIN = { id: 13579 } as const

const row = (context = SOCIAL, tripleId: `0x${string}` = LUDA_SOCIAL, shares = 4_950_000_000_000_000n): YourTrustRow => ({ tripleId, curveId: 1n, context, shares })

const view = (over: Partial<YourTrustViewProps>) => renderToStaticMarkup(createElement(YourTrustView, {
  rows: [], openKey: null, preview: null, pending: false, wrongNetwork: false, error: null, result: null, now: 0, ...over,
}))
const count = (html: string, testId: string) => html.split(`data-testid="${testId}"`).length - 1
/** The sign button's tag. */
const signTag = (html: string) => html.match(/<button[^>]*data-testid="withdraw-sign"[^>]*>/)?.[0] ?? ''

describe('the rows: one per trust context this wallet trusts it for', () => {
  const triples = [{ term_id: LUDA_SOCIAL, object_id: SOCIAL.termId }, { term_id: LUDA_CODING, object_id: CODING.termId }]

  it('one context', () => {
    const rows = rowsFromIndex(triples, [{ term_id: LUDA_SOCIAL, curve_id: '1', shares: '4950000000000000' }])
    expect(rows).toEqual([{ tripleId: LUDA_SOCIAL, curveId: 1n, context: SOCIAL, shares: 4_950_000_000_000_000n }])
  })
  it('two contexts, in the registry order', () => {
    const rows = rowsFromIndex(triples, [
      { term_id: LUDA_SOCIAL, curve_id: '1', shares: '5' },
      { term_id: LUDA_CODING, curve_id: '1', shares: '7' },
    ])
    const order = (l: string) => CANONICAL_DOMAINS_REGISTRY.findIndex((d) => d.label === l)
    expect(rows.map((r) => r.context.label)).toEqual(['AI / Coding', 'Social'].sort((a, b) => order(a) - order(b)))
  })
  it('a withdrawn (0-share) position and a triple outside the trust contexts are not rows', () => {
    expect(rowsFromIndex(triples, [{ term_id: LUDA_SOCIAL, curve_id: '1', shares: '0' }])).toEqual([])
    expect(rowsFromIndex([{ term_id: LUDA_SOCIAL, object_id: '0xnot-a-context' }], [{ term_id: LUDA_SOCIAL, curve_id: '1', shares: '5' }])).toEqual([])
  })
})

describe('readYourTrust: the indexer says which, the chain says how much', () => {
  beforeEach(() => gql.request.mockReset())

  it('asks for this agent\'s attestation triples and this wallet\'s positions (checksummed), then the chain', async () => {
    gql.request
      .mockResolvedValueOnce({ triples: [{ term_id: LUDA_SOCIAL, object_id: SOCIAL.termId }, { term_id: LUDA_CODING, object_id: CODING.termId }] })
      .mockResolvedValueOnce({ positions: [{ term_id: LUDA_SOCIAL, curve_id: '1', shares: '4950000000000000' }, { term_id: LUDA_CODING, curve_id: '1', shares: '3' }] })
    const readContract = vi.fn(async ({ args }: { args: readonly unknown[]; functionName: string }) => (args[1] === LUDA_SOCIAL ? 4_950_000_000_000_000n : 0n))
    const rows = await readYourTrust({ chain: CHAIN, readContract } as never, LUDA, OWNER_TEST_WALLET.toLowerCase())
    expect(gql.request.mock.calls[0][1]).toMatchObject({ subject: LUDA, pred: IS_SKILLED_IN.termId })
    expect(gql.request.mock.calls[1][1]).toMatchObject({ wallet: OWNER_TEST_WALLET, vaults: [LUDA_SOCIAL, LUDA_CODING] })
    expect(readContract.mock.calls.map(([c]) => c.functionName)).toEqual(['getShares', 'getShares'])
    // The chain says the Coding position is empty (the indexer lags a withdrawal): only Social is a row.
    expect(rows).toEqual([row()])
  })
  it('no triples: no trust, no chain read', async () => {
    gql.request.mockResolvedValueOnce({ triples: [] })
    const readContract = vi.fn()
    expect(await readYourTrust({ chain: CHAIN, readContract } as never, LUDA, OWNER_TEST_WALLET)).toEqual([])
    expect(readContract).not.toHaveBeenCalled()
  })
  it('a failed read throws — never "no trust"', async () => {
    gql.request.mockRejectedValueOnce(new Error('GraphQL HTTP 504'))
    await expect(readYourTrust({ chain: CHAIN, readContract: vi.fn() } as never, LUDA, OWNER_TEST_WALLET)).rejects.toThrow()
    gql.request
      .mockResolvedValueOnce({ triples: [{ term_id: LUDA_SOCIAL, object_id: SOCIAL.termId }] })
      .mockResolvedValueOnce({ positions: [{ term_id: LUDA_SOCIAL, curve_id: '1', shares: '5' }] })
    await expect(readYourTrust({ chain: CHAIN, readContract: vi.fn().mockRejectedValue(new Error('rpc down')) } as never, LUDA, OWNER_TEST_WALLET)).rejects.toThrow()
  })
  it('the preview is the contract\'s previewRedeem for every share of the row, and throws when it can\'t be read', async () => {
    const readContract = vi.fn().mockResolvedValue([4_900_500_000_000_000n, 4_950_000_000_000_000n])
    expect(await previewWithdraw({ chain: CHAIN, readContract } as never, row())).toBe(4_900_500_000_000_000n)
    expect(readContract.mock.calls[0][0]).toMatchObject({ address: getMultiVaultAddress(13579), functionName: 'previewRedeem', args: [LUDA_SOCIAL, 1n, 4_950_000_000_000_000n] })
    await expect(previewWithdraw({ chain: CHAIN, readContract: vi.fn().mockRejectedValue(new Error('x')) } as never, row())).rejects.toThrow()
  })
})

describe('the block', () => {
  it('no positions → hidden (and nothing before the first read)', () => {
    expect(view({ rows: [] })).toBe('')
    expect(view({ rows: null })).toBe('')
  })
  it('one context → one row: context, amount, Withdraw', () => {
    const html = view({ rows: [row()] })
    expect(count(html, 'your-trust-row')).toBe(1)
    expect(html).toContain('>Social</p>')
    expect(html).toContain('0.00495 tTRUST behind it')
    expect(html).toContain(`>${copy.WITHDRAW}</button>`)
    expect(html).toContain(copy.YOUR_TRUST_NOTE)
    expect(copy.YOUR_TRUST_NOTE).toBe('Changed your mind? You can take your trust back at any time.')
  })
  it('two contexts → two rows', () => {
    const html = view({ rows: [row(CODING, LUDA_CODING, 10n ** 16n), row()] })
    expect(count(html, 'your-trust-row')).toBe(2)
    expect(html).toContain('data-context="AI / Coding"')
    expect(html).toContain('data-context="Social"')
  })
  it('preview failed → the sign button is disabled, and no amount is shown', () => {
    const html = view({ rows: [row()], openKey: rowKey(row()), preview: { status: 'failed' } })
    expect(signTag(html)).toMatch(/disabled=""/)
    expect(html).toContain(copy.WITHDRAW_PREVIEW_FAILED)
    expect(html).not.toMatch(/You get back/)
  })
  it('preview still reading → disabled; read → enabled, with what comes back', () => {
    expect(signTag(view({ rows: [row()], openKey: rowKey(row()), preview: { status: 'reading' } }))).toMatch(/disabled=""/)
    const ok = view({ rows: [row()], openKey: rowKey(row()), preview: { status: 'ok', wei: 4_900_500_000_000_000n } })
    expect(signTag(ok)).not.toMatch(/disabled/)
    expect(ok).toContain('You get back 0.00490 tTRUST, plus gas.')
    expect(ok).toContain('Withdraw my trust for Social')
  })
  it('the sign rule: a read preview, nothing pending, the right network', () => {
    expect(canSignWithdraw(null, false, false)).toBe(false)
    expect(canSignWithdraw({ status: 'failed' }, false, false)).toBe(false)
    expect(canSignWithdraw({ status: 'reading' }, false, false)).toBe(false)
    expect(canSignWithdraw({ status: 'ok', wei: 1n }, true, false)).toBe(false)
    expect(canSignWithdraw({ status: 'ok', wei: 1n }, false, true)).toBe(false)
    expect(canSignWithdraw({ status: 'ok', wei: 1n }, false, false)).toBe(true)
  })
  it('after the withdrawal: the new read of who trusts it and the tier, with its age', () => {
    const now = { people: 1, tier: { tier: 'unverified' } as never, readAt: 1_000, caughtUp: true }
    const html = view({ rows: [], result: { status: 'counted', contextLabel: 'Social', now }, now: 13_000 })
    expect(html).toContain('Done. You no longer trust it for Social.')
    expect(html).toContain('Now: 1 person trusts it · Unverified · read 12 s ago')
  })
  it('no market words in this block', () => {
    const block = code('components/trust/YourTrust.tsx')
    const words = Object.entries(copy).filter(([k]) => /YOUR_TRUST|WITHDRAW|withdraw|yourTrust|trustNow|readAgo/.test(k))
      .map(([, v]) => (typeof v === 'function' ? (v as (...a: unknown[]) => string)('X', 'Y', 'Z') : String(v))).join(' ')
    for (const text of [block.replace(/import[\s\S]*?from '[^']+'/g, ''), words]) {
      expect(text).not.toMatch(/\bstake|\bsell|\bsold\b|bonding curve|\bshares? price|\bposition\b/i)
    }
  })
})

describe('withdraw uses MultiVault redeem, never the FeeProxy', () => {
  it('redeem(receiver, triple, curve, every share, minAssets) on MultiVault, from the signing wallet, no gas override', async () => {
    const writeContract = vi.fn().mockResolvedValue('0xhash')
    const waitForTransactionReceipt = vi.fn().mockResolvedValue({ status: 'success' })
    const walletClient = { account: { address: OWNER_TEST_WALLET }, chain: CHAIN, writeContract }
    const cfg = createWriteConfig(walletClient as never, { chain: CHAIN, waitForTransactionReceipt } as never)
    await withdrawTrust(cfg, row())
    expect(writeContract).toHaveBeenCalledTimes(1)
    const call = writeContract.mock.calls[0][0]
    expect(call.address).toBe(getMultiVaultAddress(13579))
    expect(call.address.toLowerCase()).not.toBe(FEE_PROXY_ADDRESS.toLowerCase())
    expect(call.functionName).toBe('redeem')
    expect(call.args).toEqual([OWNER_TEST_WALLET, LUDA_SOCIAL, 1n, 4_950_000_000_000_000n, 0n])
    expect(call.value).toBeUndefined()
    expect(call.gas).toBeUndefined() // CLAUDE.md: no gas on redeemFromVault
  })
  it('the block and its module never reach the FeeProxy or a deposit', () => {
    for (const f of ['lib/your-trust.ts', 'components/trust/YourTrust.tsx']) {
      expect(code(f), f).not.toMatch(/FEE_PROXY|FeeProxy|depositToVault|depositTriple|attestAgentSkill/)
    }
    expect(code('lib/your-trust.ts')).toMatch(/redeemFromVault\(cfg, row\.tripleId, row\.shares, account, row\.curveId\)/)
  })
  it('on every agent surface: the modal, /agents/[id] (both layouts) and /check/[id]', () => {
    expect(code('app/agents/agents-client.tsx')).toMatch(/<YourTrust agentId=\{selectedAgent\.term_id\}/)
    expect(code('app/agents/[id]/page.tsx').match(/<YourTrust agentId=/g)).toHaveLength(2)
    expect(code('app/check/[id]/page.tsx')).toMatch(/<CheckYourTrust agentId=\{card\.id\} \/>/)
  })
})
