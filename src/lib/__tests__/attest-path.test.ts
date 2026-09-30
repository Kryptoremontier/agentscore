/**
 * Etap 5a commit 1 — the path from "click Attest" to signing never dead-ends: the state machine
 * (lib/attest-gate.ts), the notices that replaced native dialogs (lib/user-notice.ts), and source
 * guards for the wiring (no DOM here; the harness shoots the connect modal).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { intuitionTestnet } from '@0xintuition/protocol'
import {
  attestStep, balanceReadOf, ATTEST_CHAIN_ID, ATTEST_STEP_ACTION,
  type AttestStep, type WalletFacts,
} from '../attest-gate'
import { ATTEST_CHAIN_ID as SERVICE_CHAIN_ID } from '../attest-service'
import { connectToVouch } from '../people-copy'
import { txFailureNotice, GET_TTRUST_LINK } from '../user-notice'
import { INTUITION_HUB_URL } from '../intuition-links'

const TESTNET = intuitionTestnet.id
const MAINNET_LIKE = 1155
const W = (connected: boolean, chainId: number | undefined, balance: WalletFacts['balance']): WalletFacts => ({ connected, chainId, balance })
const loading = { status: 'loading' } as const
const unread = { status: 'unread' } as const
const read = (wei: bigint) => ({ status: 'read', wei }) as const

// One representative wallet per step.
const AT: Record<AttestStep, WalletFacts> = {
  disconnected: W(false, undefined, unread),
  'wrong-network': W(true, MAINNET_LIKE, read(5n)),
  'checking-balance': W(true, TESTNET, loading),
  'no-balance': W(true, TESTNET, read(0n)),
  ready: W(true, TESTNET, read(10n ** 16n)),
}

describe('attestStep — the steps before signing', () => {
  it('each wallet state maps to its step, and each step offers exactly one action', () => {
    for (const [step, facts] of Object.entries(AT)) expect(attestStep(facts)).toBe(step)
    expect(ATTEST_STEP_ACTION).toEqual({
      disconnected: 'connect-wallet', 'wrong-network': 'switch-network', 'checking-balance': 'wait', 'no-balance': 'get-ttrust', ready: 'attest',
    })
  })

  it('the chain is the SDK testnet id — one value for the gate and the write service (REPO_MAP §7 rule 2)', () => {
    expect(ATTEST_CHAIN_ID).toBe(intuitionTestnet.id)
    expect(SERVICE_CHAIN_ID).toBe(ATTEST_CHAIN_ID)
    const svc = readFileSync(path.join(__dirname, '../attest-service.ts'), 'utf8')
    expect(svc).not.toMatch(/ATTEST_CHAIN_ID\s*=/) // re-exported, not redefined
  })

  // Every transition a person can cause, as the change of wallet facts that causes it.
  const TRANSITIONS: Array<[AttestStep, string, WalletFacts, AttestStep]> = [
    ['disconnected', 'connects on another network', W(true, MAINNET_LIKE, loading), 'wrong-network'],
    ['disconnected', 'connects on testnet (balance in flight)', W(true, TESTNET, loading), 'checking-balance'],
    ['disconnected', 'connects on testnet with 0 tTRUST', W(true, TESTNET, read(0n)), 'no-balance'],
    ['disconnected', 'connects on testnet with tTRUST', W(true, TESTNET, read(1n)), 'ready'],
    ['wrong-network', 'switches (balance in flight)', W(true, TESTNET, loading), 'checking-balance'],
    ['wrong-network', 'switches, 0 tTRUST', W(true, TESTNET, read(0n)), 'no-balance'],
    ['wrong-network', 'switches, has tTRUST', W(true, TESTNET, read(1n)), 'ready'],
    ['wrong-network', 'disconnects', W(false, undefined, unread), 'disconnected'],
    ['checking-balance', 'balance reads 0', W(true, TESTNET, read(0n)), 'no-balance'],
    ['checking-balance', 'balance reads > 0', W(true, TESTNET, read(1n)), 'ready'],
    ['checking-balance', 'balance read fails (unknown — not 0, not blocking)', W(true, TESTNET, unread), 'ready'],
    ['checking-balance', 'switches away', W(true, MAINNET_LIKE, loading), 'wrong-network'],
    ['checking-balance', 'disconnects', W(false, undefined, loading), 'disconnected'],
    ['no-balance', 'tTRUST arrives from the Hub', W(true, TESTNET, read(10n ** 17n)), 'ready'],
    ['no-balance', 'switches away', W(true, MAINNET_LIKE, read(0n)), 'wrong-network'],
    ['no-balance', 'disconnects', W(false, undefined, read(0n)), 'disconnected'],
    ['ready', 'switches away', W(true, MAINNET_LIKE, read(1n)), 'wrong-network'],
    ['ready', 'spends it all', W(true, TESTNET, read(0n)), 'no-balance'],
    ['ready', 'disconnects', W(false, undefined, read(1n)), 'disconnected'],
    ['ready', 'unknown chain (wallet on a chain this app does not configure)', W(true, undefined, read(1n)), 'wrong-network'],
  ]
  it.each(TRANSITIONS)('%s → (%s) → %s', (from, _why, after, to) => {
    expect(attestStep(AT[from])).toBe(from)
    expect(attestStep(after)).toBe(to)
  })

  it('every step is left somewhere and reached from somewhere', () => {
    const steps = Object.keys(AT) as AttestStep[]
    for (const s of steps) {
      expect(TRANSITIONS.some(([from]) => from === s), `${s} has a way out`).toBe(true)
      expect(TRANSITIONS.some(([, , , to]) => to === s), `${s} is reachable`).toBe(true)
    }
  })

  it('balanceReadOf: pending → loading, failed → unread (unknown), data → read — never 0 for "not read"', () => {
    expect(balanceReadOf({ data: undefined, isError: false, isPending: true })).toEqual(loading)
    expect(balanceReadOf({ data: undefined, isError: true, isPending: false })).toEqual(unread)
    expect(balanceReadOf({ data: undefined, isError: false, isPending: false })).toEqual(unread) // disabled query (no address)
    expect(balanceReadOf({ data: { value: 0n }, isError: false, isPending: false })).toEqual(read(0n))
    expect(balanceReadOf({ data: { value: 7n }, isError: true, isPending: false })).toEqual(read(7n)) // a refetch error keeps the last read
  })
})

describe('txFailureNotice — a failed write, for a person', () => {
  it('a rejection in the wallet is info, not an error', () => {
    expect(txFailureNotice('Report', new Error('User rejected the request.\n\nRequest Arguments: …'))).toEqual({ kind: 'info', text: 'Report cancelled in your wallet.' })
  })
  it('a missing balance links to the faucet (the one Hub URL)', () => {
    const n = txFailureNotice('Creating the Oppose vault', new Error('execution reverted: InsufficientBalance'))
    expect(n).toMatchObject({ kind: 'error', link: GET_TTRUST_LINK })
    expect(n.link!.href).toBe(INTUITION_HUB_URL)
  })
  it('anything else: what failed and the wallet\'s first line — not its request dump', () => {
    expect(txFailureNotice('Transaction', new Error('nonce too low\nRequest Arguments: from: 0x…'))).toEqual({ kind: 'error', text: 'Transaction failed: nonce too low' })
    expect(txFailureNotice('Transaction', undefined).text).toBe('Transaction failed: unknown error')
  })
})

describe('source guards — no native dialogs, one Hub URL, the disconnected click leads somewhere', () => {
  const SRC = path.join(__dirname, '..', '..')
  const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f)
    if (statSync(p).isDirectory()) return f === '__tests__' ? [] : files(p)
    return /\.(ts|tsx)$/.test(f) ? [p] : []
  })
  const all = files(SRC).map((f) => ({ f: path.relative(SRC, f), s: readFileSync(f, 'utf8') }))

  it('no alert(), confirm() or prompt() call anywhere in src', () => {
    const calls = all.flatMap(({ f, s }) =>
      s.split('\n').flatMap((line, i) => (/(^|[^\w.])(window\.)?(alert|confirm|prompt)\s*\(/.test(line.replace(/\/\/.*$/, '')) ? [`${f}:${i + 1}`] : [])))
    expect(calls).toEqual([])
  })

  it('the Intuition Hub URL is written once (lib/intuition-links.ts); the banner and the attest path use it', () => {
    const copies = all.filter(({ s }) => s.includes('testnet.hub.intuition.systems')).map(({ f }) => f)
    expect(copies).toEqual([path.join('lib', 'intuition-links.ts')])
    const banner = all.find(({ f }) => f.endsWith('AlphaTestnetBanner.tsx'))!.s
    expect(banner).toMatch(/href=\{INTUITION_HUB_URL\}/)
    const attest = all.find(({ f }) => f.endsWith(path.join('attest', 'AttestButton.tsx')))!.s
    expect(attest).toMatch(/href=\{INTUITION_HUB_URL\}/)
    expect(attest).toContain('You need a little testnet tTRUST to vouch — it&apos;s free.')
  })

  it('Attest, disconnected → the app\'s connect modal, then this agent\'s attest flow; wrong network → one switch button', () => {
    const attest = all.find(({ f }) => f.endsWith(path.join('attest', 'AttestButton.tsx')))!.s
    expect(attest).toMatch(/if \(!isConnected\) \{\s*\/\/[^\n]*\n\s*openConnectModal\(\{ reason: connectToVouch\(agentName\), onConnected: \(\) => setOpen\(true\) \}\)/)
    expect(connectToVouch('Luda')).toBe('Connect a wallet to vouch for Luda.')
    expect(attest).toMatch(/switchChain\(\{ chainId: ATTEST_CHAIN_ID \}\)/)
    expect(attest).toContain("'Switch to Intuition Testnet'")
    // The picker only renders at the ready step.
    expect(attest).toMatch(/\{step === 'ready' && \(status === 'pick'/)
    const forge = all.find(({ f }) => f.endsWith('ForgeStakeButtons.tsx'))!.s
    expect(forge).toMatch(/openConnectModal\(\{ reason: [^}]*onConnected: \(\) => showPanel\(s\) \}\)/)
    // One connect modal: the navbar button opens the same provider's modal.
    const wallet = all.find(({ f }) => f.endsWith(path.join('wallet', 'WalletButton.tsx')))!.s
    expect(wallet).toMatch(/onClick=\{\(\) => openConnectModal\(\)\}/)
    expect(wallet).not.toMatch(/function WalletModal/)
  })
})
