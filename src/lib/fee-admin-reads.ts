/**
 * /admin/fees (Etap 9c): the FeeProxy's fee and its admins, read live, and the rule for the form
 * that sets the fixed fee. The admin signs in their own wallet (wagmi); nothing here holds a key or
 * signs. The calldata is lib/fee-admin.ts's — the same builder scripts/fee-calldata.ts prints.
 *
 * Every read throws on failure: a screen shows "can't read", never a number it didn't read.
 * (lib/fee-admin.ts stays free of app imports — the script runs it under plain node.)
 */

import { parseAbi, parseAbiItem, parseEther, formatEther, getAddress, type PublicClient } from 'viem'
import { FEE_PROXY, FEE_CHAIN_ID, setFixedFeeCall } from './fee-admin'

const READ_ABI = parseAbi([
  'function depositFixedFee() view returns (uint256)',
  'function depositPercentageFee() view returns (uint256)',
  'function whitelistedAdmins(address) view returns (bool)',
])
/** Emitted on every admin change (topic 0xdb8e93bc…, read on testnet 2026-11-22). */
export const ADMIN_WHITELIST_EVENT = parseAbiItem('event AdminWhitelistUpdated(address indexed admin, bool status)')

export interface FeeNow { fixedFee: bigint; bps: bigint }

/** The deposit fee now: fixed (wei) and percentage (base 10,000). Never cached. */
export async function readFeeNow(pub: PublicClient): Promise<FeeNow> {
  const [fixedFee, bps] = await Promise.all([
    pub.readContract({ address: FEE_PROXY, abi: READ_ABI, functionName: 'depositFixedFee' }),
    pub.readContract({ address: FEE_PROXY, abi: READ_ABI, functionName: 'depositPercentageFee' }),
  ])
  if (typeof fixedFee !== 'bigint' || typeof bps !== 'bigint') throw new Error('unexpected fee values')
  return { fixedFee, bps }
}

/** Is this wallet a whitelisted admin of the FeeProxy, on-chain now? */
export function readIsFeeAdmin(pub: PublicClient, wallet: string): Promise<boolean> {
  return pub.readContract({ address: FEE_PROXY, abi: READ_ABI, functionName: 'whitelistedAdmins', args: [getAddress(wallet)] })
}

/**
 * The admins replayed from AdminWhitelistUpdated (last word per address), each confirmed with
 * whitelistedAdmins() now. Addresses in the order they were first added.
 */
export function adminsFromEvents(events: ReadonlyArray<{ admin: string; status: boolean }>): string[] {
  const last = new Map<string, { admin: string; status: boolean }>()
  for (const e of events) {
    const key = e.admin.toLowerCase()
    const prev = last.get(key)
    last.set(key, { admin: prev?.admin ?? getAddress(e.admin), status: e.status })
  }
  return [...last.values()].filter((e) => e.status).map((e) => e.admin)
}

export async function readFeeAdmins(pub: PublicClient): Promise<string[]> {
  const logs = await pub.getLogs({ address: FEE_PROXY, event: ADMIN_WHITELIST_EVENT, fromBlock: 0n, toBlock: 'latest' })
  const events = logs.map((l) => {
    const admin = l.args.admin
    const status = l.args.status
    if (!admin || typeof status !== 'boolean') throw new Error('unreadable admin event')
    return { admin, status }
  })
  const candidates = adminsFromEvents(events)
  const confirmed = await Promise.all(candidates.map((a) => readIsFeeAdmin(pub, a)))
  return candidates.filter((_, i) => confirmed[i])
}

/** Gas for setDepositFixedFee: simulated at ~31k on testnet; the app always sends an explicit budget. */
export const SET_FIXED_FEE_GAS = 100_000n

/** The transaction the admin's wallet signs: lib/fee-admin.ts's calldata, an explicit gas budget. */
export function setFixedFeeTx(newFeeWei: bigint) {
  const call = setFixedFeeCall(newFeeWei)
  return { to: call.to, data: call.data, value: 0n, gas: SET_FIXED_FEE_GAS, chainId: call.chainId }
}

/** "0.02" (tTRUST) → wei; null when it isn't a non-negative amount. */
export function parseFeeInput(input: string): bigint | null {
  const t = input.trim()
  if (!/^\d*\.?\d+$|^\d+\.$/.test(t)) return null
  try {
    return parseEther(t)
  } catch {
    return null
  }
}

/** 20000000000000000n → "0.02 tTRUST" (exact, no rounding). */
export const feeTTrust = (wei: bigint) => `${formatEther(wei)} tTRUST`
/** 250n → "2.5%". */
export const feePercent = (bps: bigint) => `${Number(bps) / 100}%`

export type AdminCheck = 'disconnected' | 'checking' | 'yes' | 'no' | 'failed'
export type FeeRead = { status: 'reading' } | { status: 'ok'; value: FeeNow; readAt: number } | { status: 'failed' }

export const FEE_FORM = {
  feeUnread: 'Can’t read the fee right now. Try again in a minute.',
  adminsUnread: 'Can’t read the admins right now. Try again in a minute.',
  checking: 'Checking your wallet on-chain…',
  notAdmin: 'This wallet is not a fee admin on-chain. Only a whitelisted admin can change the fee.',
  adminUnread: 'Can’t check your wallet on-chain right now. Try again in a minute.',
  disconnected: 'Connect the admin wallet.',
  wrongNetwork: 'Your wallet is on another network. Switch to Intuition Testnet.',
  badAmount: 'Enter an amount in tTRUST, like 0 or 0.02.',
  same: 'That is the fee now.',
} as const

export interface FixedFeeForm {
  enabled: boolean
  /** Why the button is disabled (null when enabled, or when nothing has been typed). */
  reason: string | null
  newWei: bigint | null
  /** The transaction to sign (when there is a valid new value). */
  tx: ReturnType<typeof setFixedFeeTx> | null
  /** How to go back: the value now and its transaction (when the fee was read). */
  undo: { wei: bigint; tx: ReturnType<typeof setFixedFeeTx> } | null
}

/**
 * The form's rule. Signable only when: the fee was read, the connected wallet is a whitelisted
 * admin on-chain, it is on Intuition Testnet, nothing is pending, and the new value is valid and
 * different from the fee now.
 */
export function fixedFeeForm(i: { fee: FeeRead; admin: AdminCheck; input: string; chainId: number | undefined; pending: boolean }): FixedFeeForm {
  const current = i.fee.status === 'ok' ? i.fee.value.fixedFee : null
  const newWei = parseFeeInput(i.input)
  const undo = current !== null ? { wei: current, tx: setFixedFeeTx(current) } : null
  const tx = newWei !== null ? setFixedFeeTx(newWei) : null
  const reason =
    i.fee.status === 'failed' ? FEE_FORM.feeUnread
    : i.fee.status === 'reading' ? null
    : i.admin === 'disconnected' ? FEE_FORM.disconnected
    : i.admin === 'checking' ? FEE_FORM.checking
    : i.admin === 'failed' ? FEE_FORM.adminUnread
    : i.admin === 'no' ? FEE_FORM.notAdmin
    : i.chainId !== FEE_CHAIN_ID ? FEE_FORM.wrongNetwork
    : i.input.trim() === '' ? null
    : newWei === null ? FEE_FORM.badAmount
    : newWei === current ? FEE_FORM.same
    : null
  const enabled = i.fee.status === 'ok' && i.admin === 'yes' && i.chainId === FEE_CHAIN_ID && !i.pending && newWei !== null && newWei !== current
  return { enabled, reason: enabled ? null : reason, newWei, tx, undo }
}
