/**
 * The steps between "click Attest" and "my attestation can be signed" (Etap 5a), as a pure state
 * machine over what the wallet says: disconnected → wrong-network → no-balance → ready. Each step
 * offers exactly one way forward (ATTEST_STEP_ACTION), so a newcomer who has never used Intuition
 * is never left at a dead end — the click used to end in a native browser dialog.
 *
 * `checking-balance` sits between wrong-network and no-balance: a balance not read yet is not 0
 * (REPO_MAP §7 rule 5), so nobody is told to fetch tTRUST they may already have. A balance read
 * that failed doesn't block either: the cost preview and the wallet still say what it costs.
 */

import { intuitionTestnet } from '@0xintuition/protocol'

export type AttestStep = 'disconnected' | 'wrong-network' | 'checking-balance' | 'no-balance' | 'ready'

/** The wallet's native balance as read: in flight, failed (unknown), or read. */
export type BalanceRead =
  | { status: 'loading' }
  | { status: 'unread' }
  | { status: 'read'; wei: bigint }

export interface WalletFacts {
  connected: boolean
  /** The wallet's chain id (raw — also when the chain isn't one this app configures). */
  chainId: number | undefined
  balance: BalanceRead
}

/** Attestations are testnet-only (lib/attest-service.ts ATTEST_CHAIN_ID is the same SDK value). */
export const ATTEST_CHAIN_ID = intuitionTestnet.id

export function attestStep(w: WalletFacts): AttestStep {
  if (!w.connected) return 'disconnected'
  if (w.chainId !== ATTEST_CHAIN_ID) return 'wrong-network'
  if (w.balance.status === 'loading') return 'checking-balance'
  if (w.balance.status === 'read' && w.balance.wei === 0n) return 'no-balance'
  return 'ready'
}

/** The one thing each step offers. */
export const ATTEST_STEP_ACTION = {
  disconnected: 'connect-wallet',
  'wrong-network': 'switch-network',
  'checking-balance': 'wait',
  'no-balance': 'get-ttrust',
  ready: 'attest',
} as const satisfies Record<AttestStep, string>

/** wagmi `useBalance` → BalanceRead. `data` undefined while pending; `isError` when the read failed. */
export function balanceReadOf(q: { data?: { value: bigint } | undefined; isError: boolean; isPending: boolean }): BalanceRead {
  if (q.data) return { status: 'read', wei: q.data.value }
  if (q.isError) return { status: 'unread' }
  return q.isPending ? { status: 'loading' } : { status: 'unread' }
}
